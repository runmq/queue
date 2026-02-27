import {RabbitMQClientAdapter} from '@src/core/clients/RabbitMQClientAdapter';
import {Exceptions} from '@src/core/exceptions/Exceptions';
import {RunMQConnectionConfigExample} from "@tests/Examples/RunMQConnectionConfigExample";

describe('RabbitMQClientAdapter E2E Tests', () => {
    const validConfig = RunMQConnectionConfigExample.valid();
    const invalidConfig = RunMQConnectionConfigExample.invalid();

    describe('connection management', () => {
        it('should connect successfully to RabbitMQ', async () => {
            const client = new RabbitMQClientAdapter(validConfig);
            await client.connect();
            expect(client.isActive()).toBe(true);
            await client.disconnect();
        }, 10000);

        it('should not reconnect if already connected', async () => {
            const client = new RabbitMQClientAdapter(validConfig);
            await client.connect();
            expect(client.isActive()).toBe(true);

            // Second connect should not throw and should remain connected
            await client.connect();
            expect(client.isActive()).toBe(true);
            await client.disconnect();
        }, 10000);

        it('should throw RunMQException on invalid connection', async () => {
            const client = new RabbitMQClientAdapter(invalidConfig);

            await expect(client.connect()).rejects.toMatchObject({
                exception: Exceptions.CONNECTION_NOT_ESTABLISHED,
            });

            expect(client.isActive()).toBe(false);
            await client.disconnect();
        }, 10000);

        it('should disconnect successfully', async () => {
            const client = new RabbitMQClientAdapter(validConfig);
            await client.connect();
            expect(client.isActive()).toBe(true);

            await client.disconnect();
            expect(client.isActive()).toBe(false);
            await client.disconnect();
        }, 10000);

        it('should handle multiple disconnects gracefully', async () => {
            const client = new RabbitMQClientAdapter(validConfig);
            await client.connect();
            await client.disconnect();

            // Second disconnect should not throw
            await expect(client.disconnect()).resolves.toBeUndefined();
            expect(client.isActive()).toBe(false);
            await client.disconnect();
        }, 10000);
    });

    describe('channel management', () => {
        it('should return different channel each time is requested', async () => {
            const client = new RabbitMQClientAdapter(validConfig);
            await client.connect();
            const channel = await client.getChannel();
            const channel2 = await client.getChannel();
            expect(channel).not.toBe(channel2);
            await client.disconnect();
        });
    })
});