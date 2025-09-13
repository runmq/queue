import {AmqplibClient} from '@src/core/clients/AmqplibClient';
import {RunMQException} from '@src/core/exceptions/RunMQException';
import {Exceptions} from '@src/core/exceptions/Exceptions';

describe('AmqplibClient E2E Tests', () => {
    const validConfig = {
        url: 'amqp://test:test@localhost:5673'
    };
    const invalidConfig = {
        url: 'amqp://invalid:invalid@localhost:9999'
    };

    describe('connection management', () => {
        it('should connect successfully to RabbitMQ', async () => {
            const client = new AmqplibClient(validConfig);
            await client.connect();
            expect(client.isActive()).toBe(true);
            await client.disconnect();
        }, 10000);

        it('should not reconnect if already connected', async () => {
            const client = new AmqplibClient(validConfig);
            await client.connect();
            expect(client.isActive()).toBe(true);

            // Second connect should not throw and should remain connected
            await client.connect();
            expect(client.isActive()).toBe(true);
            await client.disconnect();
        }, 10000);

        it('should throw RunMQException on invalid connection', async () => {
            const client = new AmqplibClient(invalidConfig);
            try {
                await client.connect();
            } catch (error) {
                expect(error).toBeInstanceOf(RunMQException);
                expect((error as RunMQException).exception).toBe(Exceptions.CONNECTION_NOT_ESTABLISHED);
            }
            expect(client.isActive()).toBe(false);
            await client.disconnect();
        }, 10000);

        it('should disconnect successfully', async () => {
            const client = new AmqplibClient(validConfig);
            await client.connect();
            expect(client.isActive()).toBe(true);

            await client.disconnect();
            expect(client.isActive()).toBe(false);
            await client.disconnect();
        }, 10000);

        it('should handle multiple disconnects gracefully', async () => {
            const client = new AmqplibClient(validConfig);
            await client.connect();
            await client.disconnect();

            // Second disconnect should not throw
            await expect(client.disconnect()).resolves.toBeUndefined();
            expect(client.isActive()).toBe(false);
            await client.disconnect();
        }, 10000);
    });

    describe('channel management', () => {
        it('should return different channel its time is requested', async () => {
            const client = new AmqplibClient(validConfig);
            await client.connect();
            const channel = await client.getChannel();
            const channel2 = await client.getChannel();
            expect(channel).not.toBe(channel2);
            await client.disconnect();
        });
    })
});