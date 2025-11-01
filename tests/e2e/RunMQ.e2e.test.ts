import {RunMQ} from '@src/core/RunMQ';
import {RunMQException} from '@src/core/exceptions/RunMQException';
import {Exceptions} from '@src/core/exceptions/Exceptions';
import {AmqplibClient} from "@src/core/clients/AmqplibClient";
import {Constants} from "@src/core/constants";
import {ChannelTestHelpers} from "@tests/helpers/ChannelTestHelpers";
import {LoggerTestHelpers} from "@tests/helpers/LoggerTestHelpers";
import {ConsumerCreatorUtils} from "@src/core/consumer/ConsumerCreatorUtils";
import {MockedRunMQLogger} from "@tests/mocks/MockedRunMQLogger";
import {RunMQConnectionConfigExample} from "@tests/Examples/RunMQConnectionConfigExample";
import {RunMQProcessorConfigurationExample} from "@tests/Examples/RunMQProcessorConfigurationExample";
import {MessageExample} from "@tests/Examples/MessageExample";
import {MessageTestUtils} from "@tests/helpers/MessageTestUtils";
import {RunMQMessage} from "@src/core/message/RunMQMessage";

describe('RunMQ E2E Tests', () => {
    const validConfig = RunMQConnectionConfigExample.valid();
    const invalidConfig = RunMQConnectionConfigExample.invalid();

    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('connection with retry logic', () => {
        it('should connect successfully on first attempt', async () => {
            const runMQ = await RunMQ.start(validConfig, MockedRunMQLogger);
            expect(runMQ.isActive()).toBe(true);
            await runMQ.disconnect();
        }, 15000);

        it('should retry and eventually fail with invalid config', async () => {
            const startTime = Date.now();
            await expect(RunMQ.start(invalidConfig, MockedRunMQLogger)).rejects.toThrow(RunMQException);
            const endTime = Date.now();

            // Should have taken at least the retry delay time
            expect(endTime - startTime).toBeGreaterThan(invalidConfig.reconnectDelay!);

            await expect(RunMQ.start(invalidConfig, MockedRunMQLogger)).rejects.toMatchObject({
                exception: Exceptions.EXCEEDING_CONNECTION_ATTEMPTS,
                details: {
                    attempts: invalidConfig.maxReconnectAttempts
                }
            })
        }, 20000);

        it('should connect after temporary network issues', async () => {
            await expect(RunMQ.start(invalidConfig, MockedRunMQLogger)).rejects.toThrow(RunMQException);

            const validRunMQ = await RunMQ.start(validConfig, MockedRunMQLogger);
            expect(validRunMQ.isActive()).toBe(true);
            await validRunMQ.disconnect();
        }, 25000);

        it('should handle disconnect properly', async () => {
            const runMQ = await RunMQ.start(validConfig, MockedRunMQLogger);
            expect(runMQ.isActive()).toBe(true);

            await runMQ.disconnect();
            expect(runMQ.isActive()).toBe(false);
        }, 15000);
    });

    describe('configuration handling', () => {
        it('should use default configuration values', async () => {
            const runMQ = await RunMQ.start({url: validConfig.url}, MockedRunMQLogger);
            expect(runMQ.isActive()).toBe(true);
            await runMQ.disconnect();
        }, 15000);

        it('should use custom configuration values', async () => {
            const customConfig = RunMQConnectionConfigExample.random(
                validConfig.url,
                50,
                1
            )
            const runMQ = await RunMQ.start(customConfig, MockedRunMQLogger);
            expect(runMQ.isActive()).toBe(true);
            await runMQ.disconnect();
        }, 15000);
    });

    describe('Initialization', () => {
        it('Should create the default router exchange on initialization', async () => {
            const runMQ = await RunMQ.start(validConfig, MockedRunMQLogger);
            const testingConnection = new AmqplibClient(validConfig);
            const channel = await testingConnection.getChannel();
            await channel.checkExchange(Constants.ROUTER_EXCHANGE_NAME);
            await channel.deleteExchange(Constants.ROUTER_EXCHANGE_NAME);
            await runMQ.disconnect();
            await testingConnection.disconnect();
        });
        it('should not throw error if router exchange is already created', async () => {
            const runMQ1 = await RunMQ.start(validConfig, MockedRunMQLogger);
            const runMQ2 = await RunMQ.start(validConfig, MockedRunMQLogger);
            await runMQ1.disconnect();
            await runMQ2.disconnect();
        });
    })

    describe('processing', () => {
        it('Should end up in DLQ when message is not meeting the schema validation', async () => {
            const configuration = RunMQProcessorConfigurationExample.simpleNoSchema()
            const testingConnection = new AmqplibClient(validConfig);
            const channel = await testingConnection.getChannel();
            await ChannelTestHelpers.deleteQueue(channel, configuration.name);

            const runMQ = await RunMQ.start(validConfig, MockedRunMQLogger);
            await runMQ.process<TestingMessage>("ad.played", configuration,
                (): Promise<void> => {
                    return Promise.resolve();
                }
            )

            channel.publish(Constants.ROUTER_EXCHANGE_NAME, 'ad.played', MessageTestUtils.buffer(MessageExample.person()))
            await ChannelTestHelpers.assertQueueMessageCount(channel, ConsumerCreatorUtils.getDLQTopicName(configuration.name), 1)
            await ChannelTestHelpers.assertQueueMessageCount(channel, configuration.name, 0)
            await ChannelTestHelpers.assertQueueMessageCount(channel, ConsumerCreatorUtils.getRetryDelayTopicName(configuration.name), 0)

            await LoggerTestHelpers.assertLoggedWithCount(MockedRunMQLogger.error, 'Message processing failed', configuration.maxRetries as number)
            await LoggerTestHelpers.assertLoggedWithCountAndParameters(MockedRunMQLogger.error, 'Message reached maximum retries. Moving to dead-letter queue.', {
                    retries: configuration.maxRetries,
                    max: configuration.maxRetries,
                },
                1
            )
            await runMQ.disconnect();
            await testingConnection.disconnect();
        })
    })

    describe('publishing', () => {
        it('should publish and consume a message successfully', async () => {
            const configuration = RunMQProcessorConfigurationExample.simpleNoSchema()
            const testingConnection = new AmqplibClient(validConfig);
            const channel = await testingConnection.getChannel();
            await ChannelTestHelpers.deleteQueue(channel, configuration.name);

            const runMQ = await RunMQ.start(validConfig, MockedRunMQLogger);
            const processedMessages: RunMQMessage[] = [];

            await runMQ.process<TestingMessage>("user.created.unique1", configuration,
                (message): Promise<void> => {
                    processedMessages.push(message);
                    return Promise.resolve();
                }
            )

            const testMessage: TestingMessage = {name: "John Doe", age: 30};
            runMQ.publish("user.created.unique1", testMessage);

            await ChannelTestHelpers.assertQueueMessageCount(channel, configuration.name, 0)
            await ChannelTestHelpers.assertQueueMessageCount(channel, ConsumerCreatorUtils.getDLQTopicName(configuration.name), 0)
            await ChannelTestHelpers.assertQueueMessageCount(channel, ConsumerCreatorUtils.getRetryDelayTopicName(configuration.name), 0)

            expect(processedMessages).toHaveLength(1);
            expect(processedMessages[0].message).toEqual(testMessage);

            await runMQ.disconnect();
            await testingConnection.disconnect();
        })

        it("should throw error when publishing invalid message", async () => {
            const runMQ = await RunMQ.start(validConfig, MockedRunMQLogger);

            expect(() => {
                runMQ.publish("user.created", "invalid message" as any);
            }).toThrow(RunMQException);

            await runMQ.disconnect();
        });
    })
});


interface TestingMessage {
    name: string;
    age: number;
}