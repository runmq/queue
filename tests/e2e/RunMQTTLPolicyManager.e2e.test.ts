import {RunMQTTLPolicyManager} from "@src/core/management/Policies/RunMQTTLPolicyManager";
import {RabbitMQManagementClient} from "@src/core/management/RabbitMQManagementClient";
import {MockedRunMQLogger} from "@tests/mocks/MockedRunMQLogger";
import {RabbitMQManagementConfigExample} from "@tests/Examples/RabbitMQManagementConfigExample";
import {RunMQUtils} from "@src/core/utils/RunMQUtils";
import {ConsumerCreatorUtils} from "@src/core/consumer/ConsumerCreatorUtils";

describe('RunMQTTLPolicyManager E2E Tests', () => {
    const validManagementConfig = RabbitMQManagementConfigExample.valid();
    let policyManager: RunMQTTLPolicyManager;
    let managementClient: RabbitMQManagementClient;

    beforeEach(() => {
        jest.clearAllMocks();
        policyManager = new RunMQTTLPolicyManager(MockedRunMQLogger, validManagementConfig);
        managementClient = new RabbitMQManagementClient(validManagementConfig, MockedRunMQLogger);
    });

    afterEach(async () => {
        await managementClient.deleteOperatorPolicy("%2F", "ttl-policy-test-queue");
        await managementClient.deleteOperatorPolicy("%2F", "ttl-policy-custom-ttl-queue");
    });

    describe('Policy Manager Initialization', () => {
        it('should initialize successfully when management plugin is enabled', async () => {
            await policyManager.initialize();
            
            expect(MockedRunMQLogger.info).toHaveBeenCalledWith(
                expect.stringContaining("RabbitMQ management plugin is enabled")
            );
        });

        it('should handle initialization when management config is not provided', async () => {
            const policyManagerWithoutConfig = new RunMQTTLPolicyManager(MockedRunMQLogger);
            await policyManagerWithoutConfig.initialize();

            expect(MockedRunMQLogger.warn).toHaveBeenCalledWith(
                "Management client not configured"
            );
        });
    });

    describe('TTL Policy Application', () => {
        beforeEach(async () => {
            await policyManager.initialize();
        });

        it('should apply TTL policy with default TTL when TTL is not specified', async () => {
            const topicName = "test-queue";
            const result = await policyManager.apply(topicName);

            expect(result).toBe(true);
            
            await RunMQUtils.delay(100);
            
            // Verify the policy was actually created
            const policy = await managementClient.getOperatorPolicy("%2F", ConsumerCreatorUtils.getMessageTTLPolicyName(topicName));
            expect(policy).not.toBeNull();
            expect(policy?.definition["message-ttl"]).toBeDefined();
            expect(policy?.pattern).toBe("test-queue");
            
            expect(MockedRunMQLogger.info).toHaveBeenCalledWith(
                expect.stringContaining("Successfully set operator policy")
            );
        });

        it('should apply TTL policy with custom TTL value', async () => {
            const topicName = "custom-ttl-queue";
            const customTTL = 60000; // 60 seconds
            
            const result = await policyManager.apply(topicName, customTTL);

            expect(result).toBe(true);
            
            await RunMQUtils.delay(100);
            
            // Verify the policy was created with the correct TTL
            const policy = await managementClient.getOperatorPolicy("%2F", ConsumerCreatorUtils.getMessageTTLPolicyName(topicName));
            expect(policy).not.toBeNull();
            expect(policy?.definition["message-ttl"]).toBe(customTTL);
            expect(policy?.pattern).toBe("custom-ttl-queue");
            
            expect(MockedRunMQLogger.info).toHaveBeenCalledWith(
                expect.stringContaining("Successfully set operator policy")
            );
        });

        it('should apply policy with custom vhost', async () => {
            const topicName = "vhost-test-queue";
            const customVhost = "%2F";
            
            const result = await policyManager.apply(topicName, undefined, customVhost);

            expect(result).toBe(true);
            
            await RunMQUtils.delay(100);
            
            await policyManager.cleanup(topicName, customVhost);
        });

        it('should return false when management plugin is not available', async () => {
            const policyManagerWithoutPlugin = new RunMQTTLPolicyManager(MockedRunMQLogger);
            await policyManagerWithoutPlugin.initialize();
            
            const result = await policyManagerWithoutPlugin.apply("test-queue");
            
            expect(result).toBe(false);
        });
    });

    describe('Policy Cleanup', () => {
        beforeEach(async () => {
            await policyManager.initialize();
        });

        it('should cleanup TTL policy successfully', async () => {
            const topicName = "cleanup-test-queue";
            
            await policyManager.apply(topicName);
            await RunMQUtils.delay(100);
            
            const policyBefore = await managementClient.getOperatorPolicy("%2F", ConsumerCreatorUtils.getMessageTTLPolicyName(topicName));
            expect(policyBefore).not.toBeNull();
            
            await policyManager.cleanup(topicName);
            await RunMQUtils.delay(100);
            
            const policyAfter = await managementClient.getOperatorPolicy("%2F", "ttl-policy-cleanup-test-queue");
            expect(policyAfter).toBeNull();
            
            expect(MockedRunMQLogger.info).toHaveBeenCalledWith(
                expect.stringContaining("Successfully deleted operator policy")
            );
        });

        it('should handle cleanup when policy does not exist', async () => {
            const topicName = "non-existent-queue";
            
            await policyManager.cleanup(topicName);
            
            await RunMQUtils.delay(100);
            expect(MockedRunMQLogger.info).toHaveBeenCalledWith(
                expect.stringContaining("Successfully deleted operator policy")
            );
        });

        it('should cleanup policy with custom vhost', async () => {
            const topicName = "vhost-cleanup-queue";
            const customVhost = "%2F";
            
            await policyManager.apply(topicName, undefined, customVhost);
            await RunMQUtils.delay(100);
            
            await policyManager.cleanup(topicName, customVhost);
            await RunMQUtils.delay(100);
            
            expect(MockedRunMQLogger.info).toHaveBeenCalledWith(
                expect.stringContaining("Successfully deleted operator policy")
            );
        });

        it('should handle cleanup when management plugin is not available', async () => {
            const policyManagerWithoutPlugin = new RunMQTTLPolicyManager(MockedRunMQLogger);
            await policyManagerWithoutPlugin.initialize();
            
            await policyManagerWithoutPlugin.cleanup("test-queue");
            
            expect(MockedRunMQLogger.info).not.toHaveBeenCalledWith(
                expect.stringContaining("Successfully deleted operator policy")
            );
        });
    });

    describe('Error Handling', () => {
        it('should handle network errors gracefully during initialization', async () => {
            const errorPolicyManager = new RunMQTTLPolicyManager(MockedRunMQLogger, RabbitMQManagementConfigExample.invalid());
            await errorPolicyManager.initialize();
            
            expect(MockedRunMQLogger.warn).toHaveBeenCalledWith(
                expect.stringContaining("Management plugin not accessible")
            );
        });

        it('should handle authentication errors', async () => {
            const authErrorPolicyManager = new RunMQTTLPolicyManager(MockedRunMQLogger, RabbitMQManagementConfigExample.invalid());
            await authErrorPolicyManager.initialize();
            
            expect(MockedRunMQLogger.warn).toHaveBeenCalledWith(
                expect.stringMatching(/Management plugin not accessible|RabbitMQ management plugin is not enabled/)
            );
        });
    });
});