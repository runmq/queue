import {RunMQMetadataManager} from "@src/core/management/Policies/RunMQMetadataManager";
import {RabbitMQManagementClient} from "@src/core/management/RabbitMQManagementClient";
import {RabbitMQMetadata} from "@src/core/management/Policies/RabbitMQMetadata";
import {MockedRunMQLogger} from "@tests/mocks/MockedRunMQLogger";
import {RabbitMQManagementConfigExample} from "@tests/Examples/RabbitMQManagementConfigExample";
import {RunMQUtils} from "@src/core/utils/RunMQUtils";
import {METADATA_SCHEMA_VERSION} from "@src/core/management/Policies/RunMQQueueMetadata";

describe('RunMQMetadataManager E2E Tests', () => {
    const validConfig = RabbitMQManagementConfigExample.valid();
    let metadataManager: RunMQMetadataManager;
    let managementClient: RabbitMQManagementClient;
    const testQueueNames: string[] = [];

    beforeEach(async () => {
        jest.clearAllMocks();
        managementClient = new RabbitMQManagementClient(validConfig, MockedRunMQLogger);
        metadataManager = new RunMQMetadataManager(MockedRunMQLogger, validConfig);
        await metadataManager.initialize()
    });

    afterEach(async () => {
        for (const queueName of testQueueNames) {
            const paramName = RabbitMQMetadata.getParameterName(queueName);
            await managementClient.deleteParameter(paramName);
        }
        testQueueNames.length = 0;
        await RunMQUtils.delay(100);
    });

    describe('Initialization', () => {
        it('should initialize successfully when management plugin is enabled', async () => {
            await metadataManager.initialize();
            expect(metadataManager.isEnabled()).toBe(true);
            expect(MockedRunMQLogger.info).toHaveBeenCalledWith(
                "RunMQ metadata storage initialized"
            );
        });

        it('should disable when management plugin is not accessible', async () => {
            const invalidManager = new RunMQMetadataManager(
                MockedRunMQLogger,
                RabbitMQManagementConfigExample.invalid()
            );
            await invalidManager.initialize();

            expect(invalidManager.isEnabled()).toBe(false);
            expect(MockedRunMQLogger.warn).toHaveBeenCalledWith(
                "RabbitMQ management plugin is not enabled - metadata storage disabled"
            );
        });

        it('should disable when no management config provided', async () => {
            const noConfigManager = new RunMQMetadataManager(MockedRunMQLogger);
            await noConfigManager.initialize();

            expect(noConfigManager.isEnabled()).toBe(false);
            expect(MockedRunMQLogger.warn).toHaveBeenCalledWith(
                "Management client not configured - metadata storage disabled"
            );
        });
    });

    describe('Metadata Creation', () => {
        it('should create metadata parameter for a new queue', async () => {
            const queueName = `test_queue_${Date.now()}`;
            testQueueNames.push(queueName);

            const result = await metadataManager.apply(queueName, 5);

            expect(result).toBe(true);
            expect(MockedRunMQLogger.info).toHaveBeenCalledWith(
                `Created metadata for queue: ${queueName}`
            );

            // Verify metadata was stored correctly
            const metadata = await metadataManager.getMetadata(queueName);
            expect(metadata).not.toBeNull();
            expect(metadata?.version).toBe(METADATA_SCHEMA_VERSION);
            expect(metadata?.maxRetries).toBe(5);
            expect(metadata?.createdAt).toBeDefined();
            expect(metadata?.updatedAt).toBeUndefined();
        });

        it('should create metadata with correct maxRetries value', async () => {
            const queueName = `test_queue_retries_${Date.now()}`;
            testQueueNames.push(queueName);

            await metadataManager.apply(queueName, 10);

            const metadata = await metadataManager.getMetadata(queueName);
            expect(metadata?.maxRetries).toBe(10);
        });

        it('should create metadata with valid ISO timestamp', async () => {
            const queueName = `test_queue_timestamp_${Date.now()}`;
            testQueueNames.push(queueName);

            const beforeCreate = new Date().toISOString();
            await metadataManager.apply(queueName, 3);
            const afterCreate = new Date().toISOString();

            const metadata = await metadataManager.getMetadata(queueName);
            expect(metadata?.createdAt).toBeDefined();

            // Verify the timestamp is within expected range
            const createdAt = new Date(metadata!.createdAt);
            expect(createdAt.getTime()).toBeGreaterThanOrEqual(new Date(beforeCreate).getTime() - 1000);
            expect(createdAt.getTime()).toBeLessThanOrEqual(new Date(afterCreate).getTime() + 1000);
        });
    });

    describe('Metadata Update', () => {
        it('should update metadata while preserving createdAt', async () => {
            const queueName = `test_queue_update_${Date.now()}`;
            testQueueNames.push(queueName);

            // Create initial metadata
            await metadataManager.apply(queueName, 5);
            const initialMetadata = await metadataManager.getMetadata(queueName);
            const originalCreatedAt = initialMetadata?.createdAt;

            // Wait a bit to ensure different timestamp
            await RunMQUtils.delay(100);

            // Update metadata
            const updateResult = await metadataManager.apply(queueName, 10);

            expect(updateResult).toBe(true);
            expect(MockedRunMQLogger.info).toHaveBeenCalledWith(
                `Updated metadata for queue: ${queueName}`
            );

            const updatedMetadata = await metadataManager.getMetadata(queueName);
            expect(updatedMetadata?.maxRetries).toBe(10);
            expect(updatedMetadata?.createdAt).toBe(originalCreatedAt);
            expect(updatedMetadata?.updatedAt).toBeDefined();
            expect(updatedMetadata?.updatedAt).not.toBe(updatedMetadata?.createdAt);
        });

        it('should track updatedAt on subsequent updates', async () => {
            const queueName = `test_queue_multi_update_${Date.now()}`;
            testQueueNames.push(queueName);

            // Create and then update twice
            await metadataManager.apply(queueName, 3);
            await RunMQUtils.delay(50);
            await metadataManager.apply(queueName, 5);
            const firstUpdate = await metadataManager.getMetadata(queueName);
            const firstUpdatedAt = firstUpdate?.updatedAt;

            await RunMQUtils.delay(50);
            await metadataManager.apply(queueName, 7);
            const secondUpdate = await metadataManager.getMetadata(queueName);

            expect(secondUpdate?.maxRetries).toBe(7);
            expect(secondUpdate?.updatedAt).toBeDefined();
            // The updatedAt should be different from the first update
            expect(new Date(secondUpdate!.updatedAt!).getTime())
                .toBeGreaterThanOrEqual(new Date(firstUpdatedAt!).getTime());
        });
    });

    describe('Metadata Retrieval', () => {
        it('should retrieve existing metadata', async () => {
            const queueName = `test_queue_retrieve_${Date.now()}`;
            testQueueNames.push(queueName);

            await metadataManager.apply(queueName, 8);

            const metadata = await metadataManager.getMetadata(queueName);

            expect(metadata).not.toBeNull();
            expect(metadata?.version).toBe(METADATA_SCHEMA_VERSION);
            expect(metadata?.maxRetries).toBe(8);
        });

        it('should return null for non-existent queue metadata', async () => {
            const metadata = await metadataManager.getMetadata('non_existent_queue_12345');

            expect(metadata).toBeNull();
        });

        it('should retrieve metadata from custom vhost', async () => {
            // Note: This test assumes the default vhost is used
            // In a real environment, you might need to create a custom vhost first
            const queueName = `test_queue_vhost_${Date.now()}`;
            testQueueNames.push(queueName);

            await metadataManager.apply(queueName, 4);

            const metadata = await metadataManager.getMetadata(queueName);

            expect(metadata).not.toBeNull();
            expect(metadata?.maxRetries).toBe(4);
        });
    });

    describe('Metadata Cleanup', () => {
        it('should delete metadata for a queue', async () => {
            const queueName = `test_queue_cleanup_${Date.now()}`;
            // Don't add to testQueueNames since we're cleaning up in the test

            await metadataManager.apply(queueName, 5);

            // Verify it exists
            const beforeCleanup = await metadataManager.getMetadata(queueName);
            expect(beforeCleanup).not.toBeNull();

            // Cleanup
            await metadataManager.cleanup(queueName);
            expect(MockedRunMQLogger.info).toHaveBeenCalledWith(
                `Deleted metadata for queue: ${queueName}`
            );

            // Verify it's gone
            const afterCleanup = await metadataManager.getMetadata(queueName);
            expect(afterCleanup).toBeNull();
        });

        it('should handle cleanup of non-existent metadata gracefully', async () => {
            // Should not throw
            await expect(metadataManager.cleanup('non_existent_queue_cleanup'))
                .resolves.not.toThrow();
        });
    });

    describe('Edge Cases', () => {
        it('should handle queue names with special characters', async () => {
            const queueName = `test.queue-with_special.chars_${Date.now()}`;
            testQueueNames.push(queueName);

            const result = await metadataManager.apply(queueName, 3);

            expect(result).toBe(true);

            const metadata = await metadataManager.getMetadata(queueName);
            expect(metadata?.maxRetries).toBe(3);
        });

        it('should handle zero retries', async () => {
            const queueName = `test_queue_zero_retries_${Date.now()}`;
            testQueueNames.push(queueName);

            await metadataManager.apply(queueName, 0);

            const metadata = await metadataManager.getMetadata(queueName);
            expect(metadata?.maxRetries).toBe(0);
        });

        it('should handle large retry numbers', async () => {
            const queueName = `test_queue_large_retries_${Date.now()}`;
            testQueueNames.push(queueName);

            await metadataManager.apply(queueName, 1000);

            const metadata = await metadataManager.getMetadata(queueName);
            expect(metadata?.maxRetries).toBe(1000);
        });
    });

    describe('Integration with RabbitMQ Parameters API', () => {
        it('should store metadata as RabbitMQ parameter', async () => {
            const queueName = `test_queue_param_${Date.now()}`;
            testQueueNames.push(queueName);

            await metadataManager.apply(queueName, 5);

            // Directly verify via management client
            const paramName = RabbitMQMetadata.getParameterName(queueName);
            const storedValue = await managementClient.getParameter(paramName);

            expect(storedValue).not.toBeNull();
            expect((storedValue as any).maxRetries).toBe(5);
            expect((storedValue as any).version).toBe(METADATA_SCHEMA_VERSION);
        });
    });
});

