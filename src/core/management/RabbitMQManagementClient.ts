import {RunMQLogger} from "@src/core/logging/RunMQLogger";
import {RabbitMQManagementConfig} from "@src";
import {RabbitMQOperatorPolicy} from "@src/types";

export class RabbitMQManagementClient {
    constructor(
        private config: RabbitMQManagementConfig,
        private logger: RunMQLogger
    ) {}

    private getAuthHeader(): string {
        const credentials = Buffer.from(`${this.config.username}:${this.config.password}`).toString('base64');
        return `Basic ${credentials}`;
    }

    public async createOrUpdateOperatorPolicy(vhost: string, policy: RabbitMQOperatorPolicy): Promise<boolean> {
        try {
            const url = `${this.config.url}/api/operator-policies/${vhost}/${encodeURIComponent(policy.name)}`;
            
            const response = await fetch(url, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': this.getAuthHeader()
                },
                body: JSON.stringify({
                    pattern: policy.pattern,
                    definition: policy.definition,
                    priority: policy.priority || 0,
                    "apply-to": policy["apply-to"]
                })
            });

            if (!response.ok) {
                const error = await response.text();
                this.logger.error(`Failed to create operator policy: ${response.status} - ${error}`);
                return false;
            }

            this.logger.info(`Successfully set operator policy: ${policy.name}`);
            return true;
        } catch (error) {
            this.logger.error(`Error creating operator policy: ${error}`);
            return false;
        }
    }

    public async getOperatorPolicy(vhost: string, policyName: string): Promise<RabbitMQOperatorPolicy | null> {
        try {
            const url = `${this.config.url}/api/operator-policies/${vhost}/${encodeURIComponent(policyName)}`;
            
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Authorization': this.getAuthHeader()
                }
            });

            if (!response.ok) {
                if (response.status === 404) {
                    return null;
                }
                const error = await response.text();
                this.logger.error(`Failed to get operator policy: ${response.status} - ${error}`);
                return null;
            }

            return await response.json();
        } catch (error) {
            this.logger.error(`Error getting operator policy: ${error}`);
            return null;
        }
    }

    public async deleteOperatorPolicy(vhost: string, policyName: string): Promise<boolean> {
        try {
            const url = `${this.config.url}/api/operator-policies/${vhost}/${encodeURIComponent(policyName)}`;
            
            const response = await fetch(url, {
                method: 'DELETE',
                headers: {
                    'Authorization': this.getAuthHeader()
                }
            });

            if (!response.ok && response.status !== 404) {
                const error = await response.text();
                this.logger.error(`Failed to delete operator policy: ${response.status} - ${error}`);
                return false;
            }

            this.logger.info(`Successfully deleted operator policy: ${policyName}`);
            return true;
        } catch (error) {
            this.logger.error(`Error deleting operator policy: ${error}`);
            return false;
        }
    }

    public async checkManagementPluginEnabled(): Promise<boolean> {
        try {
            const url = `${this.config.url}/api/overview`;
            
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Authorization': this.getAuthHeader()
                }
            });

            return response.ok;
        } catch (error) {
            this.logger.warn(`Management plugin not accessible: ${error}`);
            return false;
        }
    }
}