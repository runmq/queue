/**
 * Metadata stored for each RunMQ-managed queue.
 * This metadata is stored as a RabbitMQ operator policy with lowest priority.
 */
export interface RunMQQueueMetadata {
    /**
     * Schema version of the metadata object.
     * Used for future migrations if metadata structure changes.
     */
    version: number;

    /**
     * Maximum number of retry attempts before message goes to DLQ.
     */
    maxRetries: number;

    /**
     * ISO 8601 timestamp when the metadata was first created.
     */
    createdAt: string;

    /**
     * ISO 8601 timestamp when the metadata was last updated.
     * Only present if metadata has been updated after creation.
     */
    updatedAt?: string;
}

/**
 * Current version of the metadata schema.
 * Increment this when making breaking changes to RunMQQueueMetadata.
 */
export const METADATA_SCHEMA_VERSION = 0;

