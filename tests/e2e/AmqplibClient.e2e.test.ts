import {AmqplibClient} from '@src/core/clients/amqplibClient';
import {RunMQException} from '@src/core/exceptions/RunMQException';
import {Exceptions} from '@src/core/exceptions/Exceptions';

describe('AmqplibClient E2E Tests', () => {
    let client: AmqplibClient;
    const validConfig = {
        url: 'amqp://test:test@localhost:5673'
    };
    const invalidConfig = {
        url: 'amqp://invalid:invalid@localhost:9999'
    };

    beforeEach(async () => {
        (AmqplibClient as unknown as { instance: AmqplibClient | undefined }).instance = undefined;
        client = AmqplibClient.getInstance();
        
        try {
            await client.disconnect();
        } catch {
            // Ignore disconnect errors in setup
        }
    });

    afterEach(async () => {
        try {
            await client.disconnect();
        } catch {
            // Ignore disconnect errors in cleanup
        }
    });

    describe('connection management', () => {
        it('should connect successfully to RabbitMQ', async () => {
            await client.connect(validConfig);
            expect(client.isConnectionActive()).toBe(true);
            
            const connection = await client.getConnection();
            expect(connection).toBeDefined();
        }, 10000);

        it('should not reconnect if already connected', async () => {
            await client.connect(validConfig);
            expect(client.isConnectionActive()).toBe(true);
            
            // Second connect should not throw and should remain connected
            await client.connect(validConfig);
            expect(client.isConnectionActive()).toBe(true);
        }, 10000);

        it('should throw RunMQException on invalid connection', async () => {
            await expect(client.connect(invalidConfig))
                .rejects.toThrow(RunMQException);
                
            try {
                await client.connect(invalidConfig);
            } catch (error) {
                expect(error).toBeInstanceOf(RunMQException);
                expect((error as RunMQException).exception).toBe(Exceptions.CONNECTION_NOT_ESTABLISHED);
                expect((error as RunMQException).details.url).toBe(invalidConfig.url);
            }
            
            expect(client.isConnectionActive()).toBe(false);
        }, 10000);

        it('should disconnect successfully', async () => {
            await client.connect(validConfig);
            expect(client.isConnectionActive()).toBe(true);
            
            await client.disconnect();
            expect(client.isConnectionActive()).toBe(false);
        }, 10000);

        it('should handle multiple disconnects gracefully', async () => {
            await client.connect(validConfig);
            await client.disconnect();
            
            // Second disconnect should not throw
            await expect(client.disconnect()).resolves.toBeUndefined();
            expect(client.isConnectionActive()).toBe(false);
        }, 10000);

        it('should throw when getting connection without connecting', async () => {
            await expect(client.getConnection())
                .rejects.toThrow(RunMQException);
                
            try {
                await client.getConnection();
            } catch (error) {
                expect(error).toBeInstanceOf(RunMQException);
                expect((error as RunMQException).exception).toBe(Exceptions.CONNECTION_NOT_ESTABLISHED);
            }
        });
    });

    describe('singleton behavior', () => {
        it('should return the same instance', () => {
            const instance1 = AmqplibClient.getInstance();
            const instance2 = AmqplibClient.getInstance();
            expect(instance1).toBe(instance2);
        });
    });
});