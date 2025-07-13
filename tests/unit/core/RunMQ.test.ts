import {RunMQ} from '@src/core/RunMQ';
import {AmqplibClient} from '@src/core/clients/amqplibClient';

jest.mock('@src/core/clients/amqplibClient');

describe('RunMQ', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        const mockClient = {
            connect: jest.fn().mockResolvedValue(undefined),
            disconnect: jest.fn().mockResolvedValue(undefined),
            isConnectionActive: jest.fn().mockReturnValue(true)
        };
        (AmqplibClient.getInstance as jest.Mock).mockReturnValue(mockClient);
    });

    describe('create factory method', () => {
        it('should initialize with default config values and connect', async () => {
            const runMQ = await RunMQ.start({ url: 'amqp://localhost' });
            expect(runMQ).toBeInstanceOf(RunMQ);
            const mockClient = AmqplibClient.getInstance();
            expect(mockClient.connect).toHaveBeenCalledWith({
                url: 'amqp://localhost',
                reconnectDelay: 5000,
                maxReconnectAttempts: 5
            });
        });

        it('should initialize with custom config values and connect', async () => {
            const config = {
                url: 'amqp://localhost',
                reconnectDelay: 1000,
                maxReconnectAttempts: 3
            };
            const runMQ = await RunMQ.start(config);
            expect(runMQ).toBeInstanceOf(RunMQ);
            const mockClient = AmqplibClient.getInstance();
            expect(mockClient.connect).toHaveBeenCalledWith(config);
        });

        it('should use AmqplibClient singleton', async () => {
            await RunMQ.start({ url: 'amqp://localhost' });
            const client1 = AmqplibClient.getInstance();
            const client2 = AmqplibClient.getInstance();
            expect(client1).toBe(client2);
        });
    });
});