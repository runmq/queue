import {Constants} from "@src/core/constants";
import {METADATA_SCHEMA_VERSION, RunMQQueueMetadata} from "@src/core/management/Policies/RunMQQueueMetadata";

/**
 * Creates metadata objects for storing queue configuration.
 * Uses RabbitMQ parameters API for storage, which allows custom JSON data.
 */
export class RabbitMQMetadata {
    /**
     * Creates metadata for a queue.
     * @param maxRetries - Maximum retry attempts configured for the queue
     * @param existingMetadata - Optional existing metadata to preserve createdAt
     * @returns RunMQQueueMetadata object
     */
    static createMetadataFor(
        maxRetries: number,
        existingMetadata?: RunMQQueueMetadata
    ): RunMQQueueMetadata {
        const now = new Date().toISOString();

        return {
            version: METADATA_SCHEMA_VERSION,
            maxRetries,
            createdAt: existingMetadata?.createdAt ?? now,
            ...(existingMetadata ? { updatedAt: now } : {})
        };
    }

    /**
     * Gets the parameter name for a given queue.
     */
    static getParameterName(queueName: string): string {
        return Constants.METADATA_STORE_PREFIX + queueName;
    }
}

