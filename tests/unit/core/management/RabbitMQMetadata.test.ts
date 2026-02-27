import {RabbitMQMetadata} from "@src/core/management/Policies/RabbitMQMetadata";
import {Constants} from "@src/core/constants";
import {METADATA_SCHEMA_VERSION, RunMQQueueMetadata} from "@src/core/management/Policies/RunMQQueueMetadata";

describe('RabbitMQMetadata', () => {
    const mockDate = '2024-01-15T10:30:00.000Z';

    beforeEach(() => {
        jest.useFakeTimers();
        jest.setSystemTime(new Date(mockDate));
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    describe('createMetadataFor', () => {
        it('should create metadata with correct version', () => {
            const metadata = RabbitMQMetadata.createMetadataFor(3);

            expect(metadata.version).toBe(METADATA_SCHEMA_VERSION);
        });

        it('should include maxRetries in metadata', () => {
            const maxRetries = 10;
            const metadata = RabbitMQMetadata.createMetadataFor( maxRetries);

            expect(metadata.maxRetries).toBe(maxRetries);
        });

        it('should set createdAt when no existing metadata provided', () => {
            const metadata = RabbitMQMetadata.createMetadataFor( 3);

            expect(metadata.createdAt).toBe(mockDate);
            expect(metadata.updatedAt).toBeUndefined();
        });

        it('should preserve createdAt and set updatedAt when existing metadata provided', () => {
            const existingCreatedAt = '2023-01-01T00:00:00.000Z';
            const existingMetadata: RunMQQueueMetadata = {
                version: 0,
                maxRetries: 3,
                createdAt: existingCreatedAt
            };

            const metadata = RabbitMQMetadata.createMetadataFor( 5, existingMetadata);

            expect(metadata.createdAt).toBe(existingCreatedAt);
            expect(metadata.updatedAt).toBe(mockDate);
            expect(metadata.maxRetries).toBe(5);
        });
    });

    describe('getParameterName', () => {
        it('should return correct parameter name', () => {
            const queueName = 'test_processor';
            const paramName = RabbitMQMetadata.getParameterName(queueName);

            expect(paramName).toBe(Constants.METADATA_STORE_PREFIX + queueName);
        });
    });
});

