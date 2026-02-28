import {AmqplibClientAdapter} from '@src/core/clients/AmqplibClientAdapter';
import {AMQPChannel} from '@src/types';
import {RunMQConnectionConfigExample} from "@tests/Examples/RunMQConnectionConfigExample";
import {MessageTestUtils} from "@tests/helpers/MessageTestUtils";

describe('AmqplibChannel E2E Tests', () => {
    const validConfig = RunMQConnectionConfigExample.valid();
    let client: AmqplibClientAdapter;

    beforeAll(async () => {
        client = new AmqplibClientAdapter(validConfig);
        await client.connect();
    });

    afterAll(async () => {
        await client.disconnect();
    });

    describe('queue operations', () => {
        it('should assert a queue and return queue info', async () => {
            const channel = await client.getChannel();
            const queue = `_test_assert_queue_${Date.now()}`;
            try {
                const result = await channel.assertQueue(queue, {durable: false});
                expect(result.queue).toBe(queue);
                expect(result.messageCount).toBe(0);
                expect(result.consumerCount).toBe(0);
            } finally {
                try { await channel.deleteQueue(queue); } catch { /* ignore */ }
                try { await channel.close(); } catch { /* ignore */ }
            }
        });

        it('should check an existing queue', async () => {
            const channel = await client.getChannel();
            const queue = `_test_check_queue_${Date.now()}`;
            try {
                await channel.assertQueue(queue, {durable: false});
                const result = await channel.checkQueue(queue);
                expect(result.queue).toBe(queue);
                expect(typeof result.messageCount).toBe('number');
                expect(typeof result.consumerCount).toBe('number');
            } finally {
                try { await channel.deleteQueue(queue); } catch { /* ignore */ }
                try { await channel.close(); } catch { /* ignore */ }
            }
        });

        it('should assert a queue with dead letter options', async () => {
            const channel = await client.getChannel();
            const queue = `_test_dlq_opts_${Date.now()}`;
            try {
                const result = await channel.assertQueue(queue, {
                    durable: false,
                    deadLetterExchange: 'some-dlx',
                    deadLetterRoutingKey: 'some-dlq-key',
                    messageTtl: 5000,
                });
                expect(result.queue).toBe(queue);
            } finally {
                try { await channel.deleteQueue(queue); } catch { /* ignore */ }
                try { await channel.close(); } catch { /* ignore */ }
            }
        });

        it('should delete a queue and return message count', async () => {
            const channel = await client.getChannel();
            const queue = `_test_delete_queue_${Date.now()}`;
            try {
                await channel.assertQueue(queue, {durable: false});
                const result = await channel.deleteQueue(queue);
                expect(typeof result.messageCount).toBe('number');
            } finally {
                try { await channel.close(); } catch { /* ignore */ }
            }
        });

        it('should throw when checking a non-existent queue', async () => {
            // amqplib closes the channel on a 404, so use a dedicated channel
            const channel = await client.getChannel();
            const nonExistent = `_test_nonexistent_queue_${Date.now()}`;
            await expect(channel.checkQueue(nonExistent)).rejects.toThrow();
        });
    });

    describe('exchange operations', () => {
        it('should assert an exchange and return exchange info', async () => {
            const channel = await client.getChannel();
            const exchange = `_test_assert_exchange_${Date.now()}`;
            try {
                const result = await channel.assertExchange(exchange, 'direct', {durable: false});
                expect(result.exchange).toBe(exchange);
            } finally {
                try { await channel.deleteExchange(exchange); } catch { /* ignore */ }
                try { await channel.close(); } catch { /* ignore */ }
            }
        });

        it('should check an existing exchange', async () => {
            const channel = await client.getChannel();
            const exchange = `_test_check_exchange_${Date.now()}`;
            try {
                await channel.assertExchange(exchange, 'direct', {durable: false});
                const result = await channel.checkExchange(exchange);
                expect(result.exchange).toBe(exchange);
            } finally {
                try { await channel.deleteExchange(exchange); } catch { /* ignore */ }
                try { await channel.close(); } catch { /* ignore */ }
            }
        });

        it('should delete an exchange', async () => {
            const channel = await client.getChannel();
            const exchange = `_test_delete_exchange_${Date.now()}`;
            try {
                await channel.assertExchange(exchange, 'direct', {durable: false});
                await expect(channel.deleteExchange(exchange)).resolves.toBeUndefined();
            } finally {
                try { await channel.close(); } catch { /* ignore */ }
            }
        });

        it('should throw when checking a non-existent exchange', async () => {
            const channel = await client.getChannel();
            const nonExistent = `_test_nonexistent_exchange_${Date.now()}`;
            await expect(channel.checkExchange(nonExistent)).rejects.toThrow();
        });
    });

    describe('bind, publish, and consume', () => {
        it('should publish a message and consume it', async () => {
            const channel = await client.getChannel();
            const queue = `_test_pubsub_${Date.now()}`;
            const exchange = `_test_pubsub_exchange_${Date.now()}`;
            const routingKey = 'test.routing.key';

            try {
                await channel.assertExchange(exchange, 'direct', {durable: false});
                await channel.assertQueue(queue, {durable: false});
                await channel.bindQueue(queue, exchange, routingKey);

                const payload = {hello: 'world', ts: Date.now()};
                const content = MessageTestUtils.buffer(payload);

                const published = channel.publish(exchange, routingKey, content, {
                    contentType: 'application/json',
                    persistent: false,
                    messageId: 'test-msg-1',
                    correlationId: 'corr-1',
                });
                expect(published).toBe(true);

                const received = await new Promise<any>((resolve) => {
                    channel.consume(queue, (msg) => {
                        resolve(msg);
                    }, {noAck: true});
                });

                expect(received).not.toBeNull();
                const body = JSON.parse(received.content.toString());
                expect(body).toEqual(payload);
                expect(received.fields.exchange).toBe(exchange);
                expect(received.fields.routingKey).toBe(routingKey);
                expect(received.properties.messageId).toBe('test-msg-1');
                expect(received.properties.correlationId).toBe('corr-1');
                expect(received.properties.contentType).toBe('application/json');
            } finally {
                try { await channel.deleteQueue(queue); } catch { /* ignore */ }
                try { await channel.deleteExchange(exchange); } catch { /* ignore */ }
                try { await channel.close(); } catch { /* ignore */ }
            }
        }, 10000);

        it('should ack a consumed message', async () => {
            const channel = await client.getChannel();
            const queue = `_test_ack_${Date.now()}`;
            try {
                await channel.assertQueue(queue, {durable: false});
                await channel.prefetch(1);

                const content = MessageTestUtils.buffer({ack: true});
                channel.publish('', queue, content);

                const received = await new Promise<any>((resolve) => {
                    channel.consume(queue, (msg) => {
                        resolve(msg);
                    }, {noAck: false});
                });

                expect(() => channel.ack(received)).not.toThrow();

                await new Promise(r => setTimeout(r, 200));
                const info = await channel.checkQueue(queue);
                expect(info.messageCount).toBe(0);
            } finally {
                try { await channel.deleteQueue(queue); } catch { /* ignore */ }
                try { await channel.close(); } catch { /* ignore */ }
            }
        }, 10000);

        it('should nack and requeue a message', async () => {
            const channel = await client.getChannel();
            const queue = `_test_nack_${Date.now()}`;
            try {
                await channel.assertQueue(queue, {durable: false});
                await channel.prefetch(1);

                const content = MessageTestUtils.buffer({nack: true});
                channel.publish('', queue, content);

                let receiveCount = 0;
                const receivedTwice = new Promise<void>((resolve) => {
                    channel.consume(queue, (msg) => {
                        if (!msg) return;
                        receiveCount++;
                        if (receiveCount === 1) {
                            // Nack with requeue on first delivery
                            channel.nack(msg, false, true);
                        } else {
                            // Ack on second delivery to stop the loop
                            channel.ack(msg);
                            resolve();
                        }
                    }, {noAck: false});
                });

                await receivedTwice;
                expect(receiveCount).toBe(2);
            } finally {
                try { await channel.deleteQueue(queue); } catch { /* ignore */ }
                try { await channel.close(); } catch { /* ignore */ }
            }
        }, 10000);
    });

    describe('prefetch', () => {
        it('should set prefetch count without error', async () => {
            const channel = await client.getChannel();
            try {
                await expect(channel.prefetch(10)).resolves.toBeUndefined();
            } finally {
                try { await channel.close(); } catch { /* ignore */ }
            }
        });
    });

    describe('channel close', () => {
        it('should close a channel without error', async () => {
            const channel = await client.getChannel();
            await expect(channel.close()).resolves.toBeUndefined();
        });
    });
});
