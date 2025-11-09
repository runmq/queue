import {RunMQTTLPolicyManager} from "@src/core/management/Policies/RunMQTTLPolicyManager";
import {RabbitMQManagementClient} from "@src/core/management/RabbitMQManagementClient";
import {RunMQConsoleLogger} from "@src/core/logging/RunMQConsoleLogger";
import {RabbitMQMessageTTLPolicyExample} from "@tests/Examples/RabbitMQOperatorPolicyExamples";
import {RabbitMQManagementConfigExample} from "@tests/Examples/RabbitMQManagementConfigExample";

jest.mock("@src/core/management/RabbitMQManagementClient");

describe('TTLPolicyManager', () => {
    let ttlPolicyManager: RunMQTTLPolicyManager;
    let logger: RunMQConsoleLogger;
    let mockManagementClient: jest.Mocked<RabbitMQManagementClient>;

    beforeEach(() => {
        logger = new RunMQConsoleLogger();
        jest.spyOn(logger, 'info').mockImplementation();
        jest.spyOn(logger, 'warn').mockImplementation();

        mockManagementClient = new RabbitMQManagementClient(
            RabbitMQManagementConfigExample.valid(),
            logger
        ) as jest.Mocked<RabbitMQManagementClient>;
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('without management config', () => {
        beforeEach(() => {
            ttlPolicyManager = new RunMQTTLPolicyManager(logger);
        });

        it('should initialize without management client', async () => {
            await ttlPolicyManager.initialize();

            expect(logger.warn).toHaveBeenCalledWith(
                "Management client not configured"
            );
        });

        it('should return false when management is not configured', async () => {
            await ttlPolicyManager.initialize();
            const result = await ttlPolicyManager.apply('test-queue', 5000);
            expect(result).toBe(false);
        });
    });

    describe('with management config', () => {
        beforeEach(() => {
            ttlPolicyManager = new RunMQTTLPolicyManager(logger, RabbitMQManagementConfigExample.valid());

            (ttlPolicyManager as any).managementClient = mockManagementClient;
        });

        it('should check if management plugin is enabled during initialization', async () => {
            mockManagementClient.checkManagementPluginEnabled.mockResolvedValue(true);

            await ttlPolicyManager.initialize();

            expect(mockManagementClient.checkManagementPluginEnabled).toHaveBeenCalled();
            expect(logger.info).toHaveBeenCalledWith(
                "RabbitMQ management plugin is enabled"
            );
        });

        it('should return false when management plugin is not enabled', async () => {
            mockManagementClient.checkManagementPluginEnabled.mockResolvedValue(false);

            await ttlPolicyManager.initialize();
            const result = await ttlPolicyManager.apply('test-queue', 5000);
            expect(result).toBe(false);
        });

        it('should create operator policy when management plugin is enabled', async () => {
            mockManagementClient.checkManagementPluginEnabled.mockResolvedValue(true);
            mockManagementClient.createOrUpdateOperatorPolicy.mockResolvedValue(true);

            await ttlPolicyManager.initialize();
            await ttlPolicyManager.apply('test-queue', 5000);

            expect(mockManagementClient.createOrUpdateOperatorPolicy).toHaveBeenCalledWith(
                '%2F',
                RabbitMQMessageTTLPolicyExample.validPolicy('test-queue', 5000)
            );
        });

        it('should return false when policy creation fails', async () => {
            mockManagementClient.checkManagementPluginEnabled.mockResolvedValue(true);
            mockManagementClient.createOrUpdateOperatorPolicy.mockResolvedValue(false);

            await ttlPolicyManager.initialize();
            const result = await ttlPolicyManager.apply('test-queue', 5000);
            expect(result).toBe(false);
        });

        it('should escape special characters in queue name for policy pattern', async () => {
            mockManagementClient.checkManagementPluginEnabled.mockResolvedValue(true);
            mockManagementClient.createOrUpdateOperatorPolicy.mockResolvedValue(true);

            await ttlPolicyManager.initialize();
            await ttlPolicyManager.apply('test.queue[special]', 5000);

            expect(mockManagementClient.createOrUpdateOperatorPolicy).toHaveBeenCalledWith(
                '%2F',
                expect.objectContaining({
                    pattern: 'test\\.queue\\[special\\]'
                })
            );
        });

        it('should cleanup policy when requested', async () => {
            mockManagementClient.checkManagementPluginEnabled.mockResolvedValue(true);
            mockManagementClient.deleteOperatorPolicy.mockResolvedValue(true);

            await ttlPolicyManager.initialize();
            await ttlPolicyManager.cleanup('test-queue');

            expect(mockManagementClient.deleteOperatorPolicy).toHaveBeenCalledWith(
                '%2F',
                'ttl-policy-test-queue'
            );
        });

        it('should handle custom vhost', async () => {
            mockManagementClient.checkManagementPluginEnabled.mockResolvedValue(true);
            mockManagementClient.createOrUpdateOperatorPolicy.mockResolvedValue(true);

            await ttlPolicyManager.initialize();
            await ttlPolicyManager.apply('test-queue', 5000, 'custom-vhost');

            expect(mockManagementClient.createOrUpdateOperatorPolicy).toHaveBeenCalledWith(
                'custom-vhost',
                expect.any(Object)
            );
        });
    });
});