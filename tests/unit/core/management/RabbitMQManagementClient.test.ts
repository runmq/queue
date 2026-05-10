import {RabbitMQManagementClient} from "@src/core/management/RabbitMQManagementClient";
import {RunMQConsoleLogger} from "@src/core/logging/RunMQConsoleLogger";
import {RabbitMQMessageTTLPolicyExample} from "@tests/Examples/RabbitMQOperatorPolicyExamples";
import {RabbitMQManagementConfigExample} from "@tests/Examples/RabbitMQManagementConfigExample";
import {ConsumerCreatorUtils} from "@src/core/consumer/ConsumerCreatorUtils";

describe('RabbitMQManagementClient', () => {
    let client: RabbitMQManagementClient;
    let logger: RunMQConsoleLogger;
    let requestSpy: jest.SpyInstance;
    const MANAGEMENT_URL = "http://localhost:15673/api/operator-policies/%2F/"

    beforeEach(() => {
        logger = new RunMQConsoleLogger();
        client = new RabbitMQManagementClient(
            RabbitMQManagementConfigExample.valid(),
            logger
        );

        // Spy on the private node:http/https request helper. The boundary is
        // intentionally kept private to the class — tests reach through the
        // TS-private modifier (which has no runtime effect) to mock it.
        requestSpy = jest.spyOn(client as unknown as { request: () => unknown }, 'request');
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('createOperatorPolicy', () => {
        it('should successfully create an operator policy', async () => {
            requestSpy.mockResolvedValueOnce({ok: true, status: 201, body: ''});

            const result = await client.createOrUpdateOperatorPolicy('%2F', RabbitMQMessageTTLPolicyExample.validPolicy('test-queue', 5000));

            expect(result).toBe(true);
            expect(requestSpy).toHaveBeenCalledWith(
                MANAGEMENT_URL + ConsumerCreatorUtils.getMessageTTLPolicyName('test-queue'),
                'PUT',
                {
                    pattern: 'test-queue',
                    definition: {
                        'message-ttl': 5000
                    },
                    priority: 1000,
                    'apply-to': 'queues'
                }
            );
        });

        it('should handle failed policy creation', async () => {
            requestSpy.mockResolvedValueOnce({ok: false, status: 400, body: 'Bad Request'});

            const result = await client.createOrUpdateOperatorPolicy('%2F', RabbitMQMessageTTLPolicyExample.validPolicy());

            expect(result).toBe(false);
        });
    });

    describe('checkManagementPluginEnabled', () => {
        it('should return true when management plugin is accessible', async () => {
            requestSpy.mockResolvedValueOnce({ok: true, status: 200, body: ''});

            const result = await client.checkManagementPluginEnabled();

            expect(result).toBe(true);
            expect(requestSpy).toHaveBeenCalledWith(
                'http://localhost:15673/api/overview',
                'GET'
            );
        });

        it('should return false when management plugin is not accessible', async () => {
            requestSpy.mockResolvedValueOnce({ok: false, status: 404, body: ''});

            const result = await client.checkManagementPluginEnabled();

            expect(result).toBe(false);
        });

        it('should return false on network error', async () => {
            requestSpy.mockRejectedValueOnce(new Error('Network error'));

            const result = await client.checkManagementPluginEnabled();

            expect(result).toBe(false);
        });
    });

    describe('deleteOperatorPolicy', () => {
        it('should successfully delete an operator policy', async () => {
            requestSpy.mockResolvedValueOnce({ok: true, status: 204, body: ''});

            const result = await client.deleteOperatorPolicy('%2F', 'test-queue');

            expect(result).toBe(true);
            expect(requestSpy).toHaveBeenCalledWith(
                MANAGEMENT_URL + 'test-queue',
                'DELETE'
            );
        });

        it('should handle 404 as success', async () => {
            requestSpy.mockResolvedValueOnce({ok: false, status: 404, body: 'Not Found'});

            const result = await client.deleteOperatorPolicy('%2F', 'test-policy');

            expect(result).toBe(true);
        });
    });
});
