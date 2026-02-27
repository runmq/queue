import {RunMQMetadataManager} from "@src/core/management/Policies/RunMQMetadataManager";
import {RabbitMQManagementClient} from "@src/core/management/RabbitMQManagementClient";
import {RunMQConsoleLogger} from "@src/core/logging/RunMQConsoleLogger";
import {RabbitMQManagementConfigExample} from "@tests/Examples/RabbitMQManagementConfigExample";
import {RabbitMQMetadata} from "@src/core/management/Policies/RabbitMQMetadata";
import {METADATA_SCHEMA_VERSION} from "@src/core/management/Policies/RunMQQueueMetadata";

jest.mock("@src/core/management/RabbitMQManagementClient");

describe('RunMQMetadataManager', () => {
    let metadataManager: RunMQMetadataManager;
    let logger: RunMQConsoleLogger;
    let mockManagementClient: jest.Mocked<RabbitMQManagementClient>;

    const mockDate = '2024-01-15T10:30:00.000Z';

    beforeEach(() => {
        jest.useFakeTimers();
        jest.setSystemTime(new Date(mockDate));

        logger = new RunMQConsoleLogger();
        jest.spyOn(logger, 'info').mockImplementation();
        jest.spyOn(logger, 'warn').mockImplementation();
        jest.spyOn(logger, 'error').mockImplementation();

        mockManagementClient = new RabbitMQManagementClient(
            RabbitMQManagementConfigExample.valid(),
            logger
        ) as jest.Mocked<RabbitMQManagementClient>;
    });

    afterEach(() => {
        jest.useRealTimers();
        jest.clearAllMocks();
    });

    describe('without management config', () => {
        beforeEach(() => {
            metadataManager = new RunMQMetadataManager(logger);
        });

        it('should initialize without management client', async () => {
            await metadataManager.initialize();

            expect(logger.warn).toHaveBeenCalledWith(
                "Management client not configured - metadata storage disabled"
            );
        });

        it('should return false when applying metadata without management config', async () => {
            await metadataManager.initialize();
            const result = await metadataManager.apply('test-queue', 5);

            expect(result).toBe(false);
        });

        it('should return null when getting metadata without management config', async () => {
            await metadataManager.initialize();
            const result = await metadataManager.getMetadata('test-queue');

            expect(result).toBeNull();
        });

        it('should report as disabled', async () => {
            await metadataManager.initialize();
            expect(metadataManager.isEnabled()).toBe(false);
        });
    });

    describe('with management config', () => {
        beforeEach(() => {
            metadataManager = new RunMQMetadataManager(
                logger,
                RabbitMQManagementConfigExample.valid()
            );
            (metadataManager as any).managementClient = mockManagementClient;
        });

        describe('initialize', () => {
            it('should check if management plugin is enabled', async () => {
                mockManagementClient.checkManagementPluginEnabled.mockResolvedValue(true);

                await metadataManager.initialize();

                expect(mockManagementClient.checkManagementPluginEnabled).toHaveBeenCalled();
                expect(logger.info).toHaveBeenCalledWith("RunMQ metadata storage initialized");
            });

            it('should log warning when management plugin is not enabled', async () => {
                mockManagementClient.checkManagementPluginEnabled.mockResolvedValue(false);

                await metadataManager.initialize();

                expect(logger.warn).toHaveBeenCalledWith(
                    "RabbitMQ management plugin is not enabled - metadata storage disabled"
                );
            });
        });

        describe('apply', () => {
            it('should create metadata parameter for new queue', async () => {
                mockManagementClient.checkManagementPluginEnabled.mockResolvedValue(true);
                mockManagementClient.getParameter.mockResolvedValue(null);
                mockManagementClient.setParameter.mockResolvedValue(true);

                await metadataManager.initialize();
                const result = await metadataManager.apply('test_queue', 5);

                expect(result).toBe(true);
                expect(mockManagementClient.setParameter).toHaveBeenCalledWith(
                    RabbitMQMetadata.getParameterName('test_queue'),
                    expect.objectContaining({
                        version: METADATA_SCHEMA_VERSION,
                        maxRetries: 5,
                        createdAt: mockDate
                    })
                );
                expect(logger.info).toHaveBeenCalledWith("Created metadata for queue: test_queue");
            });

            it('should update existing metadata preserving createdAt', async () => {
                const existingCreatedAt = '2023-01-01T00:00:00.000Z';
                const existingMetadata = {
                    version: 0,
                    maxRetries: 3,
                    createdAt: existingCreatedAt
                };

                mockManagementClient.checkManagementPluginEnabled.mockResolvedValue(true);
                mockManagementClient.getParameter.mockResolvedValue(existingMetadata);
                mockManagementClient.setParameter.mockResolvedValue(true);

                await metadataManager.initialize();
                const result = await metadataManager.apply('test_queue', 10);

                expect(result).toBe(true);
                expect(mockManagementClient.setParameter).toHaveBeenCalledWith(
                    RabbitMQMetadata.getParameterName('test_queue'),
                    expect.objectContaining({
                        maxRetries: 10,
                        createdAt: existingCreatedAt,
                        updatedAt: mockDate
                    })
                );
                expect(logger.info).toHaveBeenCalledWith("Updated metadata for queue: test_queue");
            });

            it('should return false when management plugin is not enabled', async () => {
                mockManagementClient.checkManagementPluginEnabled.mockResolvedValue(false);

                await metadataManager.initialize();
                const result = await metadataManager.apply('test_queue', 5);

                expect(result).toBe(false);
                expect(logger.warn).toHaveBeenCalledWith(
                    expect.stringContaining("Cannot store metadata for queue 'test_queue'")
                );
            });

            it('should return false when parameter creation fails', async () => {
                mockManagementClient.checkManagementPluginEnabled.mockResolvedValue(true);
                mockManagementClient.getParameter.mockResolvedValue(null);
                mockManagementClient.setParameter.mockResolvedValue(false);

                await metadataManager.initialize();
                const result = await metadataManager.apply('test_queue', 5);

                expect(result).toBe(false);
                expect(logger.error).toHaveBeenCalledWith(
                    "Failed to store metadata for queue: test_queue"
                );
            });

            it('should use custom vhost when provided', async () => {
                mockManagementClient.checkManagementPluginEnabled.mockResolvedValue(true);
                mockManagementClient.getParameter.mockResolvedValue(null);
                mockManagementClient.setParameter.mockResolvedValue(true);

                await metadataManager.initialize();
                await metadataManager.apply('test_queue', 5, 'custom_vhost');

                expect(mockManagementClient.setParameter).toHaveBeenCalledWith(
                    expect.any(String),
                    expect.any(Object)
                );
            });
        });

        describe('getMetadata', () => {
            it('should return metadata when parameter exists', async () => {
                const expectedMetadata = {
                    version: 0,
                    maxRetries: 5,
                    createdAt: mockDate
                };

                mockManagementClient.checkManagementPluginEnabled.mockResolvedValue(true);
                mockManagementClient.getParameter.mockResolvedValue(expectedMetadata);

                await metadataManager.initialize();
                const result = await metadataManager.getMetadata('test_queue');

                expect(result).toEqual(expectedMetadata);
            });

            it('should return null when parameter does not exist', async () => {
                mockManagementClient.checkManagementPluginEnabled.mockResolvedValue(true);
                mockManagementClient.getParameter.mockResolvedValue(null);

                await metadataManager.initialize();
                const result = await metadataManager.getMetadata('test_queue');

                expect(result).toBeNull();
            });

            it('should return null when management plugin is not enabled', async () => {
                mockManagementClient.checkManagementPluginEnabled.mockResolvedValue(false);

                await metadataManager.initialize();
                const result = await metadataManager.getMetadata('test_queue');

                expect(result).toBeNull();
            });
        });

        describe('cleanup', () => {
            it('should delete metadata parameter', async () => {
                mockManagementClient.checkManagementPluginEnabled.mockResolvedValue(true);
                mockManagementClient.deleteParameter.mockResolvedValue(true);

                await metadataManager.initialize();
                await metadataManager.cleanup('test_queue');

                expect(mockManagementClient.deleteParameter).toHaveBeenCalledWith(
                    RabbitMQMetadata.getParameterName('test_queue')
                );
                expect(logger.info).toHaveBeenCalledWith(
                    "Deleted metadata for queue: test_queue"
                );
            });

            it('should not call delete when management plugin is not enabled', async () => {
                mockManagementClient.checkManagementPluginEnabled.mockResolvedValue(false);

                await metadataManager.initialize();
                await metadataManager.cleanup('test_queue');

                expect(mockManagementClient.deleteParameter).not.toHaveBeenCalled();
            });
        });

        describe('isEnabled', () => {
            it('should return true when management plugin is enabled', async () => {
                mockManagementClient.checkManagementPluginEnabled.mockResolvedValue(true);

                await metadataManager.initialize();

                expect(metadataManager.isEnabled()).toBe(true);
            });

            it('should return false when management plugin is not enabled', async () => {
                mockManagementClient.checkManagementPluginEnabled.mockResolvedValue(false);

                await metadataManager.initialize();

                expect(metadataManager.isEnabled()).toBe(false);
            });
        });
    });
});

