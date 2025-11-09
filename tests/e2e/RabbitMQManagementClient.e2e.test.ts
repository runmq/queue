import {RabbitMQManagementClient} from "@src/core/management/RabbitMQManagementClient";
import {MockedRunMQLogger} from "@tests/mocks/MockedRunMQLogger";
import {RabbitMQManagementConfigExample} from "@tests/Examples/RabbitMQManagementConfigExample";
import {RabbitMQMessageTTLPolicyExample} from "@tests/Examples/RabbitMQOperatorPolicyExamples";
import {RunMQUtils} from "@src/core/utils/RunMQUtils";
import {RabbitMQOperatorPolicy} from "@src/types";

describe('RabbitMQManagementClient E2E Tests', () => {
    const validConfig = RabbitMQManagementConfigExample.valid();
    let managementClient: RabbitMQManagementClient;

    beforeEach(() => {
        jest.clearAllMocks();
        managementClient = new RabbitMQManagementClient(validConfig, MockedRunMQLogger);
    });

    afterEach(async () => {
        const testPolicies = [
            "test-policy-1",
            "test-policy-2",
            "test-policy-update",
            "test-policy-delete",
            "test-priority-policy",
            "test-pattern-policy",
            "ttl-policy-test-queue-e2e"
        ];

        for (const policyName of testPolicies) {
            await managementClient.deleteOperatorPolicy("%2F", policyName);
        }

        await RunMQUtils.delay(100);
    });

    describe('Management Plugin Check', () => {
        it('should successfully detect when management plugin is enabled', async () => {
            const isEnabled = await managementClient.checkManagementPluginEnabled();

            expect(isEnabled).toBe(true);
        });

        it('should handle connection to non-existent management endpoint', async () => {
            const invalidClient = new RabbitMQManagementClient(
                RabbitMQManagementConfigExample.invalid(),
                MockedRunMQLogger
            );

            const isEnabled = await invalidClient.checkManagementPluginEnabled();

            expect(isEnabled).toBe(false);
            expect(MockedRunMQLogger.warn).toHaveBeenCalledWith(
                expect.stringContaining("Management plugin not accessible")
            );
        });

        it('should handle authentication failure', async () => {
            const unauthorizedClient = new RabbitMQManagementClient(
                RabbitMQManagementConfigExample.invalidCredentials(),
                MockedRunMQLogger
            );

            const isEnabled = await unauthorizedClient.checkManagementPluginEnabled();

            expect(isEnabled).toBe(false);
        });
    });

    describe('Operator Policy Creation', () => {
        it('should create a new operator policy successfully', async () => {
            const policy = RabbitMQMessageTTLPolicyExample.validPolicy("test-queue-e2e", 10000);

            const result = await managementClient.createOrUpdateOperatorPolicy("%2F", policy);

            expect(result).toBe(true);
            expect(MockedRunMQLogger.info).toHaveBeenCalledWith(
                expect.stringContaining("Successfully set operator policy")
            );

            const retrievedPolicy = await managementClient.getOperatorPolicy("%2F", policy.name);
            expect(retrievedPolicy).not.toBeNull();
            expect(retrievedPolicy?.pattern).toBe(policy.pattern);
            expect(retrievedPolicy?.definition["message-ttl"]).toBe(10000);
        });

        it('should create policy with custom pattern and definition', async () => {
            const customPolicy: RabbitMQOperatorPolicy = {
                name: "test-pattern-policy",
                pattern: "^test\\..*",
                definition: {
                    "message-ttl": 5000,
                    "max-length": 100
                },
                "apply-to": "queues",
                priority: 10
            };

            const result = await managementClient.createOrUpdateOperatorPolicy("%2F", customPolicy);

            expect(result).toBe(true);
            expect(MockedRunMQLogger.info).toHaveBeenCalledWith(
                expect.stringContaining("Successfully set operator policy: test-pattern-policy")
            );

            const retrievedPolicy = await managementClient.getOperatorPolicy("%2F", "test-pattern-policy");
            expect(retrievedPolicy).not.toBeNull();
            expect(retrievedPolicy?.pattern).toBe("^test\\..*");
            expect(retrievedPolicy?.definition["message-ttl"]).toBe(5000);
            expect(retrievedPolicy?.definition["max-length"]).toBe(100);
            expect(retrievedPolicy?.priority).toBe(10);
        });

        it('should update an existing policy', async () => {
            const initialPolicy: RabbitMQOperatorPolicy = {
                name: "test-policy-update",
                pattern: "update-queue",
                definition: {
                    "message-ttl": 5000
                },
                "apply-to": "queues"
            };

            await managementClient.createOrUpdateOperatorPolicy("%2F", initialPolicy);
            await RunMQUtils.delay(100);

            const initialRetrieved = await managementClient.getOperatorPolicy("%2F", "test-policy-update");
            expect(initialRetrieved?.definition["message-ttl"]).toBe(5000);

            const updatedPolicy: RabbitMQOperatorPolicy = {
                ...initialPolicy,
                definition: {
                    "message-ttl": 10000
                }
            };

            const updateResult = await managementClient.createOrUpdateOperatorPolicy("%2F", updatedPolicy);

            expect(updateResult).toBe(true);

            const updatedRetrieved = await managementClient.getOperatorPolicy("%2F", "test-policy-update");
            expect(updatedRetrieved?.definition["message-ttl"]).toBe(10000);
        });
    });

    describe('Operator Policy Retrieval', () => {
        it('should retrieve an existing operator policy', async () => {
            const policy: RabbitMQOperatorPolicy = {
                name: "test-policy-1",
                pattern: "test-queue",
                definition: {
                    "message-ttl": 5000
                },
                "apply-to": "queues"
            };

            await managementClient.createOrUpdateOperatorPolicy("%2F", policy);
            await RunMQUtils.delay(100);

            const retrievedPolicy = await managementClient.getOperatorPolicy("%2F", "test-policy-1");

            expect(retrievedPolicy).not.toBeNull();
            expect(retrievedPolicy?.name).toBe("test-policy-1");
            expect(retrievedPolicy?.pattern).toBe("test-queue");
            expect(retrievedPolicy?.definition["message-ttl"]).toBe(5000);
            expect(retrievedPolicy?.["apply-to"]).toBe("queues");
        });

        it('should return null for non-existent policy', async () => {
            const retrievedPolicy = await managementClient.getOperatorPolicy("%2F", "non-existent-policy");

            expect(retrievedPolicy).toBeNull();
        });

        it('should handle errors when retrieving policy', async () => {
            const retrievedPolicy = await managementClient.getOperatorPolicy("invalid%vhost", "test-policy");

            expect(retrievedPolicy).toBeNull();
            expect(MockedRunMQLogger.error).toHaveBeenCalledWith(
                expect.stringContaining("Failed to get operator policy")
            );
        });
    });

    describe('Operator Policy Deletion', () => {
        it('should delete an existing operator policy successfully', async () => {
            const policy: RabbitMQOperatorPolicy = {
                name: "test-policy-delete",
                pattern: "delete-queue",
                definition: {
                    "message-ttl": 5000
                },
                "apply-to": "queues"
            };

            await managementClient.createOrUpdateOperatorPolicy("%2F", policy);
            await RunMQUtils.delay(100);

            const policyBefore = await managementClient.getOperatorPolicy("%2F", "test-policy-delete");
            expect(policyBefore).not.toBeNull();

            const result = await managementClient.deleteOperatorPolicy("%2F", "test-policy-delete");

            expect(result).toBe(true);
            expect(MockedRunMQLogger.info).toHaveBeenCalledWith(
                expect.stringContaining("Successfully deleted operator policy: test-policy-delete")
            );

            const policyAfter = await managementClient.getOperatorPolicy("%2F", "test-policy-delete");
            expect(policyAfter).toBeNull();
        });

        it('should handle deletion of non-existent policy gracefully', async () => {
            const result = await managementClient.deleteOperatorPolicy("%2F", "non-existent-policy");

            expect(result).toBe(true); // Should return true for 404 (not found)
            expect(MockedRunMQLogger.info).toHaveBeenCalledWith(
                expect.stringContaining("Successfully deleted operator policy")
            );
        });

        it('should handle deletion errors', async () => {
            const result = await managementClient.deleteOperatorPolicy("invalid%vhost", "test-policy");

            expect(result).toBe(false);
            expect(MockedRunMQLogger.error).toHaveBeenCalledWith(
                expect.stringContaining("Failed to delete operator policy")
            );
        });
    });

    describe('Concurrent Operations', () => {
        it('should handle multiple concurrent policy creations', async () => {
            const policies: RabbitMQOperatorPolicy[] = [
                {
                    name: "test-policy-1",
                    pattern: "queue-1",
                    definition: {"message-ttl": 5000},
                    "apply-to": "queues"
                },
                {
                    name: "test-policy-2",
                    pattern: "queue-2",
                    definition: {"message-ttl": 10000},
                    "apply-to": "queues"
                }
            ];

            const results = await Promise.all(
                policies.map(policy =>
                    managementClient.createOrUpdateOperatorPolicy("%2F", policy)
                )
            );

            expect(results).toEqual([true, true]);

            const policy1 = await managementClient.getOperatorPolicy("%2F", "test-policy-1");
            const policy2 = await managementClient.getOperatorPolicy("%2F", "test-policy-2");

            expect(policy1).not.toBeNull();
            expect(policy2).not.toBeNull();
            expect(policy1?.definition["message-ttl"]).toBe(5000);
            expect(policy2?.definition["message-ttl"]).toBe(10000);
        });

        it('should handle concurrent policy operations (create/delete)', async () => {
            const policy: RabbitMQOperatorPolicy = {
                name: "concurrent-test-policy",
                pattern: "concurrent-queue",
                definition: {"message-ttl": 5000},
                "apply-to": "queues"
            };

            await managementClient.createOrUpdateOperatorPolicy("%2F", policy);
            await RunMQUtils.delay(100);

            const [createResult, deleteResult] = await Promise.all([
                managementClient.createOrUpdateOperatorPolicy("%2F", {
                    ...policy,
                    name: "concurrent-test-policy-2"
                }),
                managementClient.deleteOperatorPolicy("%2F", "concurrent-test-policy")
            ]);

            expect(createResult).toBe(true);
            expect(deleteResult).toBe(true);

            await managementClient.deleteOperatorPolicy("%2F", "concurrent-test-policy-2");
        });
    });

    describe('Network Error Recovery', () => {
        it('should handle network timeouts gracefully', async () => {
            const timeoutClient = new RabbitMQManagementClient(
                RabbitMQManagementConfigExample.nonRoutableHost(),
                MockedRunMQLogger
            );

            const policy: RabbitMQOperatorPolicy = {
                name: "timeout-test",
                pattern: "timeout-queue",
                definition: {"message-ttl": 5000},
                "apply-to": "queues"
            };

            const result = await timeoutClient.createOrUpdateOperatorPolicy("%2F", policy);

            expect(result).toBe(false);
            expect(MockedRunMQLogger.error).toHaveBeenCalledWith(
                expect.stringContaining("Error creating operator policy")
            );
        });
    });
});