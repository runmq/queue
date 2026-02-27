import {RabbitMQManagementClient} from "@src/core/management/RabbitMQManagementClient";
import {RunMQLogger} from "@src/core/logging/RunMQLogger";
import {RabbitMQManagementConfig} from "@src";
import {RabbitMQMetadata} from "@src/core/management/Policies/RabbitMQMetadata";
import {RunMQQueueMetadata} from "@src/core/management/Policies/RunMQQueueMetadata";

/**
 * Manages metadata for RunMQ queues.
 * Stores queue configuration metadata using RabbitMQ parameters API.
 */
export class RunMQMetadataManager {
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

    /**
     * Initialize the manager by checking if management plugin is available.
     */
    public async initialize(): Promise<void> {
        if (!this.managementClient) {
            this.logger.warn("Management client not configured - metadata storage disabled");
            return;
        }

        this.isManagementPluginEnabled = await this.managementClient.checkManagementPluginEnabled();

        if (!this.isManagementPluginEnabled) {
            this.logger.warn("RabbitMQ management plugin is not enabled - metadata storage disabled");
        } else {
            this.logger.info("RunMQ metadata storage initialized");
        }
    }

    /**
     * Store or update metadata for a queue.
     * If metadata already exists, preserves createdAt and sets updatedAt.
     *
     * @param queueName - The name of the queue
     * @param maxRetries - Maximum retry attempts
     * @returns true if metadata was stored successfully, false otherwise
     */
    public async apply(
        queueName: string,
        maxRetries: number,
    ): Promise<boolean> {
        if (!this.isManagementPluginEnabled || !this.managementClient) {
            this.logger.warn(`Cannot store metadata for queue '${queueName}' - management plugin not available`);
            return false;
        }

        try {
            const existingMetadata = await this.getMetadata(queueName);
            const metadata = RabbitMQMetadata.createMetadataFor(
                maxRetries,
                existingMetadata ?? undefined
            );

            const paramName = RabbitMQMetadata.getParameterName(queueName);

            const success = await this.managementClient.setParameter(
                paramName,
                metadata
            );

            if (success) {
                const action = existingMetadata ? "Updated" : "Created";
                this.logger.info(`${action} metadata for queue: ${queueName}`);
                return true;
            }

            this.logger.error(`Failed to store metadata for queue: ${queueName}`);
            return false;
        } catch (error) {
            this.logger.error(`Error storing metadata for queue ${queueName}: ${error}`);
            return false;
        }
    }

    /**
     * Get metadata for a queue.
     *
     * @param queueName - The name of the queue
     * @returns The queue metadata or null if not found
     */
    public async getMetadata(
        queueName: string,
    ): Promise<RunMQQueueMetadata | null> {
        if (!this.isManagementPluginEnabled || !this.managementClient) {
            return null;
        }

        try {
            const paramName = RabbitMQMetadata.getParameterName(queueName);

            return await this.managementClient.getParameter<RunMQQueueMetadata>(
                paramName
            );
        } catch (error) {
            this.logger.warn(`Failed to get metadata for queue ${queueName}: ${error}`);
            return null;
        }
    }

    /**
     * Delete metadata for a queue.
     *
     * @param queueName - The name of the queue
     */
    public async cleanup(queueName: string): Promise<void> {
        if (!this.isManagementPluginEnabled || !this.managementClient) {
            return;
        }

        const paramName = RabbitMQMetadata.getParameterName(queueName);
        await this.managementClient.deleteParameter(paramName);
        this.logger.info(`Deleted metadata for queue: ${queueName}`);
    }

    /**
     * Check if management plugin is enabled and metadata storage is available.
     */
    public isEnabled(): boolean {
        return this.isManagementPluginEnabled;
    }
}

