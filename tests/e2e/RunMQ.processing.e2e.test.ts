import {RunMQ} from '@src/core/RunMQ';
import {AmqplibClient} from "@src/core/clients/AmqplibClient";
import {Constants} from "@src/core/constants";
import {ChannelTestHelpers} from "@tests/helpers/ChannelTestHelpers";
import {RunMQProcessorConfiguration} from "@src/types";
import {RunMQLogger} from "@src/core/logging/RunMQLogger";
import {ConsumerCreatorUtils} from "@src/core/consumer/ConsumerCreatorUtils";
import {JSONSchemaType} from "@node_modules/ajv";
import {RunMQUtils} from "@src/core/utils/Utils";

describe('RunMQ E2E Tests', () => {
    const validConfig = {
        url: 'amqp://test:test@localhost:5673',
        reconnectDelay: 100,
        maxReconnectAttempts: 3
    };

    const mockedLogger: RunMQLogger = {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn(),
        log: jest.fn(),
        verbose: jest.fn(),
    }

    beforeEach(() => {
        jest.clearAllMocks();
    });

    const testingConnection = new AmqplibClient(validConfig);

    describe('processing behaviours', () => {
        it('Should process the message correctly given valid RunMQMessage structure without schema', async () => {
            const configuration: RunMQProcessorConfiguration = {
                name: "createInDatabaseOnAdPlayed",
                maxRetries: 3,
                consumersCount: 1,
                retryDelay: 100,
            }

            const channel = await testingConnection.getChannel();
            await ChannelTestHelpers.deleteQueue(channel, configuration.name);

            const runMQ = await RunMQ.start(validConfig, mockedLogger);
            let counter = 0;
            await runMQ.process<TestingMessage>("ad.played", configuration,
                () => {
                    counter++;
                    return Promise.resolve();
                }
            )

            channel.publish(Constants.ROUTER_EXCHANGE_NAME, 'ad.played', Buffer.from(JSON.stringify({
                    message: {
                        name: "Test Ad",
                        value: 5
                    },
                    meta: {
                        id: "123",
                        correlationId: "corr-123",
                        publishedAt: Date.now()
                    }
                }))
            )

            await RunMQUtils.delay(500);
            expect(counter).toBe(1);
            await ChannelTestHelpers.assertQueueMessageCount(channel, ConsumerCreatorUtils.getDLQTopicName(configuration.name), 0)
            await ChannelTestHelpers.assertQueueMessageCount(channel, configuration.name, 0)
            await ChannelTestHelpers.assertQueueMessageCount(channel, ConsumerCreatorUtils.getRetryDelayTopicName(configuration.name), 0)
            await runMQ.disconnect();
            await testingConnection.disconnect();
        })

        it('Should process the message correctly given valid RunMQMessage structure with schema', async () => {
            class TestData {
                name!: string;
                value!: number;
            }

            const schema: JSONSchemaType<TestData> = {
                type: "object",
                properties: {
                    name: {type: "string"},
                    value: {type: "number"}
                },
                required: ["name", "value"]
            };
            const configuration: RunMQProcessorConfiguration = {
                name: "createInElasticSearchOnAdPlayed",
                maxRetries: 3,
                consumersCount: 1,
                retryDelay: 100,
                messageSchema: {
                    type: "ajv",
                    schema: schema,
                    failureStrategy: "dlq"
                }
            }

            const channel = await testingConnection.getChannel();
            await ChannelTestHelpers.deleteQueue(channel, configuration.name);

            const runMQ = await RunMQ.start(validConfig, mockedLogger);
            let counter = 0;
            await runMQ.process<TestingMessage>("ad.played", configuration,
                () => {
                    counter++;
                    return Promise.resolve();
                }
            )

            channel.publish(Constants.ROUTER_EXCHANGE_NAME, 'ad.played', Buffer.from(JSON.stringify({
                    message: {
                        name: "Test Ad",
                        value: 5
                    },
                    meta: {
                        id: "123",
                        correlationId: "corr-123",
                        publishedAt: Date.now()
                    }
                }))
            )

            await RunMQUtils.delay(500);
            expect(counter).toBe(1);
            await ChannelTestHelpers.assertQueueMessageCount(channel, ConsumerCreatorUtils.getDLQTopicName(configuration.name), 0)
            await ChannelTestHelpers.assertQueueMessageCount(channel, configuration.name, 0)
            await ChannelTestHelpers.assertQueueMessageCount(channel, ConsumerCreatorUtils.getRetryDelayTopicName(configuration.name), 0)
            await runMQ.disconnect();
            await testingConnection.disconnect();
        })

        it('Should retry processing errors up to maxRetries before sending to DLQ', async () => {
            const configuration: RunMQProcessorConfiguration = {
                name: "processingErrorRetryTest",
                maxRetries: 2,
                consumersCount: 1,
                retryDelay: 100,
            }

            const channel = await testingConnection.getChannel();
            await ChannelTestHelpers.deleteQueue(channel, configuration.name);
            await ChannelTestHelpers.deleteQueue(channel, ConsumerCreatorUtils.getDLQTopicName(configuration.name));
            await ChannelTestHelpers.deleteQueue(channel, ConsumerCreatorUtils.getRetryDelayTopicName(configuration.name));

            const runMQ = await RunMQ.start(validConfig, mockedLogger);
            let attemptCount = 0;
            await runMQ.process<TestingMessage>("ad.error", configuration,
                () => {
                    attemptCount++;
                    throw new Error("Processing failed");
                }
            )

            channel.publish(Constants.ROUTER_EXCHANGE_NAME, 'ad.error', Buffer.from(JSON.stringify({
                    message: {
                        name: "Test Ad",
                        value: 5
                    },
                    meta: {
                        id: "123",
                        correlationId: "corr-123",
                        publishedAt: Date.now()
                    }
                }))
            )

            await RunMQUtils.delay(100);
            expect(attemptCount).toBe(1);

            await RunMQUtils.delay(200);
            expect(attemptCount).toBe(2);

            await ChannelTestHelpers.assertQueueMessageCount(channel, ConsumerCreatorUtils.getDLQTopicName(configuration.name), 1)
            await ChannelTestHelpers.assertQueueMessageCount(channel, configuration.name, 0)
            await ChannelTestHelpers.assertQueueMessageCount(channel, ConsumerCreatorUtils.getRetryDelayTopicName(configuration.name), 0)
            await runMQ.disconnect();
            await testingConnection.disconnect();
        })

        it('Should handle malformed JSON messages gracefully', async () => {
            const configuration: RunMQProcessorConfiguration = {
                name: "malformedJsonTest",
                maxRetries: 1,
                consumersCount: 1,
                retryDelay: 100,
            }

            const channel = await testingConnection.getChannel();
            await ChannelTestHelpers.deleteQueue(channel, configuration.name);
            await ChannelTestHelpers.deleteQueue(channel, ConsumerCreatorUtils.getDLQTopicName(configuration.name));

            const runMQ = await RunMQ.start(validConfig, mockedLogger);
            let processorCalled = false;
            await runMQ.process<TestingMessage>("ad.malformed", configuration,
                () => {
                    processorCalled = true;
                    return Promise.resolve();
                }
            )

            // Send malformed JSON
            channel.publish(Constants.ROUTER_EXCHANGE_NAME, 'ad.malformed', Buffer.from("{invalid json}"))

            await RunMQUtils.delay(500);
            expect(processorCalled).toBe(false);
            // Malformed JSON should go to DLQ after retries
            await ChannelTestHelpers.assertQueueMessageCount(channel, ConsumerCreatorUtils.getDLQTopicName(configuration.name), 1)
            await ChannelTestHelpers.assertQueueMessageCount(channel, configuration.name, 0)
            await runMQ.disconnect();
            await testingConnection.disconnect();
        })

        it('Should respect retry delay timing between retries', async () => {
            const configuration: RunMQProcessorConfiguration = {
                name: "retryDelayTimingTest",
                maxRetries: 3,
                consumersCount: 1,
                retryDelay: 300, // 300ms retry delay
            }

            const channel = await testingConnection.getChannel();
            await ChannelTestHelpers.deleteQueue(channel, configuration.name);
            await ChannelTestHelpers.deleteQueue(channel, ConsumerCreatorUtils.getRetryDelayTopicName(configuration.name));

            const runMQ = await RunMQ.start(validConfig, mockedLogger);
            const attemptTimestamps: number[] = [];
            await runMQ.process<TestingMessage>("ad.timing", configuration,
                () => {
                    attemptTimestamps.push(Date.now());
                    if (attemptTimestamps.length < 3) {
                        throw new Error("Retry me");
                    }
                    return Promise.resolve();
                }
            )

            channel.publish(Constants.ROUTER_EXCHANGE_NAME, 'ad.timing', Buffer.from(JSON.stringify({
                    message: {
                        name: "Test Ad",
                        value: 5
                    },
                    meta: {
                        id: "123",
                        correlationId: "corr-123",
                        publishedAt: Date.now()
                    }
                }))
            )

            // Wait for all attempts
            await RunMQUtils.delay(1000);

            expect(attemptTimestamps.length).toBe(3);

            // Verify retry delays (with 50ms tolerance)
            const firstRetryDelay = attemptTimestamps[1] - attemptTimestamps[0];
            const secondRetryDelay = attemptTimestamps[2] - attemptTimestamps[1];

            expect(firstRetryDelay).toBeGreaterThanOrEqual(250);  // At least 300ms - 50ms tolerance
            expect(firstRetryDelay).toBeLessThanOrEqual(350);     // At most 300ms + 50ms tolerance

            expect(secondRetryDelay).toBeGreaterThanOrEqual(250);
            expect(secondRetryDelay).toBeLessThanOrEqual(350);

            await runMQ.disconnect();
            await testingConnection.disconnect();
        })

        it('Should handle multiple consumers processing messages concurrently', async () => {
            const configuration: RunMQProcessorConfiguration = {
                name: "multipleConcurrentConsumers",
                maxRetries: 1,
                consumersCount: 3, // 3 concurrent consumers
                retryDelay: 100,
            }

            const channel = await testingConnection.getChannel();
            await ChannelTestHelpers.deleteQueue(channel, configuration.name);

            const runMQ = await RunMQ.start(validConfig, mockedLogger);
            const processedMessages = new Set<string>();
            let processingCount = 0;

            await runMQ.process<TestingMessage>("ad.concurrent", configuration,
                async (message) => {
                    processingCount++;
                    // Simulate processing time
                    await RunMQUtils.delay(500);
                    processedMessages.add(message.meta.id);
                    processingCount--;
                    return;
                }
            )

            // Publish multiple messages
            for (let i = 1; i <= 6; i++) {
                channel.publish(Constants.ROUTER_EXCHANGE_NAME, 'ad.concurrent', Buffer.from(JSON.stringify({
                        message: {
                            name: `Test Ad ${i}`,
                            value: i
                        },
                        meta: {
                            id: `msg-${i}`,
                            correlationId: `corr-${i}`,
                            publishedAt: Date.now()
                        }
                    }))
                )
            }
            // Small delay to let processing start
            await RunMQUtils.delay(1000);
            expect(processedMessages.size).toBe(6);
            expect(processingCount).toBe(0);
            await ChannelTestHelpers.assertQueueMessageCount(channel, configuration.name, 0)
            await runMQ.disconnect();
            await testingConnection.disconnect();
        })
    })
});


interface TestingMessage {
    name: string;
    age: number;
}