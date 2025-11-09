import {RabbitMQManagementClient} from "@src/core/management/RabbitMQManagementClient";
import {RunMQConsoleLogger} from "@src/core/logging/RunMQConsoleLogger";
import {RabbitMQMessageTTLPolicyExample} from "@tests/Examples/RabbitMQOperatorPolicyExamples";
import {RabbitMQManagementConfigExample} from "@tests/Examples/RabbitMQManagementConfigExample";
import {ConsumerCreatorUtils} from "@src/core/consumer/ConsumerCreatorUtils";

describe('RabbitMQManagementClient', () => {
    let client: RabbitMQManagementClient;
    let logger: RunMQConsoleLogger;
    let fetchSpy: jest.SpyInstance;
    const MANAGEMENT_URL = "http://localhost:15673/api/operator-policies/%2F/"

    beforeEach(() => {
        logger = new RunMQConsoleLogger();
        client = new RabbitMQManagementClient(
            RabbitMQManagementConfigExample.valid(),
            logger
        );

        global.fetch = jest.fn();
        fetchSpy = jest.spyOn(global, 'fetch');
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('createOperatorPolicy', () => {
        it('should successfully create an operator policy', async () => {
            fetchSpy.mockResolvedValueOnce({
                ok: true,
                status: 201,
                text: async () => ''
            } as Response);

            const result = await client.createOrUpdateOperatorPolicy('%2F', RabbitMQMessageTTLPolicyExample.validPolicy('test-queue', 5000));

            expect(result).toBe(true);
            expect(fetchSpy).toHaveBeenCalledWith(
                MANAGEMENT_URL + ConsumerCreatorUtils.getMessageTTLPolicyName('test-queue'),
                expect.objectContaining({
                    method: 'PUT',
                    headers: expect.objectContaining({
                        'Content-Type': 'application/json',
                        'Authorization': expect.stringContaining('Basic')
                    }),
                    body: JSON.stringify({
                        pattern: 'test-queue',
                        definition: {
                            'message-ttl': 5000
                        },
                        priority: 1000,
                        'apply-to': 'queues'
                    })
                })
            );
        });

        it('should handle failed policy creation', async () => {
            fetchSpy.mockResolvedValueOnce({
                ok: false,
                status: 400,
                text: async () => 'Bad Request'
            } as Response);

            const result = await client.createOrUpdateOperatorPolicy('%2F', RabbitMQMessageTTLPolicyExample.validPolicy());

            expect(result).toBe(false);
        });
    });

    describe('checkManagementPluginEnabled', () => {
        it('should return true when management plugin is accessible', async () => {
            fetchSpy.mockResolvedValueOnce({
                ok: true,
                status: 200
            } as Response);

            const result = await client.checkManagementPluginEnabled();

            expect(result).toBe(true);
            expect(fetchSpy).toHaveBeenCalledWith(
                'http://localhost:15673/api/overview',
                expect.objectContaining({
                    method: 'GET',
                    headers: expect.objectContaining({
                        'Authorization': expect.stringContaining('Basic')
                    })
                })
            );
        });

        it('should return false when management plugin is not accessible', async () => {
            fetchSpy.mockResolvedValueOnce({
                ok: false,
                status: 404
            } as Response);

            const result = await client.checkManagementPluginEnabled();

            expect(result).toBe(false);
        });

        it('should return false on network error', async () => {
            fetchSpy.mockRejectedValueOnce(new Error('Network error'));

            const result = await client.checkManagementPluginEnabled();

            expect(result).toBe(false);
        });
    });

    describe('deleteOperatorPolicy', () => {
        it('should successfully delete an operator policy', async () => {
            fetchSpy.mockResolvedValueOnce({
                ok: true,
                status: 204,
                text: async () => ''
            } as Response);

            const result = await client.deleteOperatorPolicy('%2F', 'test-queue');

            expect(result).toBe(true);
            expect(fetchSpy).toHaveBeenCalledWith(
                MANAGEMENT_URL + 'test-queue',
                expect.objectContaining({
                    method: 'DELETE',
                    headers: expect.objectContaining({
                        'Authorization': expect.stringContaining('Basic')
                    })
                })
            );
        });

        it('should handle 404 as success', async () => {
            fetchSpy.mockResolvedValueOnce({
                ok: false,
                status: 404,
                text: async () => 'Not Found'
            } as Response);

            const result = await client.deleteOperatorPolicy('%2F', 'test-policy');

            expect(result).toBe(true);
        });
    });
});