import {RabbitMQManagementClient} from "@src/core/management/RabbitMQManagementClient";
import {RunMQLogger} from "@src/core/logging/RunMQLogger";
import {DEFAULTS} from "@src/core/constants";
import {RabbitMQManagementConfig} from "@src";
import {RabbitMQMessageTTLPolicy} from "@src/core/management/Policies/RabbitMQMessageTTLPolicy";

export class RunMQTTLPolicyManager {
    private readonly managementClient: RabbitMQManagementClient | null = null;
    private isManagementPluginEnabled = false;

    constructor(
        private logger: RunMQLogger,
        private managementConfig?: RabbitMQManagementConfig
    ) {
        if (this.managementConfig) {
            this.managementClient = new RabbitMQManagementClient(this.managementConfig, this.logger);
        }
    }

    public async initialize(): Promise<void> {
        if (!this.managementClient) {
            this.logger.warn("Management client not configured");
            return;
        }

        this.isManagementPluginEnabled = await this.managementClient.checkManagementPluginEnabled();

        if (!this.isManagementPluginEnabled) {
            this.logger.warn("RabbitMQ management plugin is not enabled");
        } else {
            this.logger.info("RabbitMQ management plugin is enabled");
        }
    }

    public async apply(
        queueName: string,
        ttl?: number,
        vhost: string = "%2F"
    ): Promise<boolean> {
        const actualTTL = ttl ?? DEFAULTS.PROCESSING_RETRY_DELAY;

        if (this.isManagementPluginEnabled && this.managementClient) {
            const success = await this.managementClient.createOrUpdateOperatorPolicy(
                vhost,
                RabbitMQMessageTTLPolicy.createFor(queueName, actualTTL)
            );

            if (success) {
                return true
            }
        }
        return false;
    }


    public async cleanup(queueName: string, vhost: string = "%2F"): Promise<void> {
        if (this.isManagementPluginEnabled && this.managementClient) {
            const policyName = `ttl-policy-${queueName}`;
            await this.managementClient.deleteOperatorPolicy(vhost, policyName);
        }
    }
}