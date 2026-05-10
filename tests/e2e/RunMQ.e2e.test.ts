import {RunMQ} from '@src/core/RunMQ';
import {RunMQException} from '@src/core/exceptions/RunMQException';
import {Exceptions} from '@src/core/exceptions/Exceptions';
import {RabbitMQClientAdapter} from "@src/core/clients/RabbitMQClientAdapter";
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
        }, 30000);

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
            const testingConnection = new RabbitMQClientAdapter(validConfig);
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
            // simpleNoSchema's default messageSchema has failureStrategy: 'dlq',
            // so per issue #23 a schema-validation failure must short-circuit
            // straight to the DLQ — no retries, no handler invocation.
            const configuration = RunMQProcessorConfigurationExample.simpleNoSchema()
            const testingConnection = new RabbitMQClientAdapter(validConfig);
            const channel = await testingConnection.getChannel();
            await ChannelTestHelpers.deleteQueue(channel, configuration.name);

            const runMQ = await RunMQ.start(validConfig, MockedRunMQLogger);
            let handlerCalls = 0;
            await runMQ.process<TestingMessage>("runmq.e2e.ad.played", configuration,
                (): Promise<void> => {
                    handlerCalls++;
                    return Promise.resolve();
                }
            )

            channel.publish(Constants.ROUTER_EXCHANGE_NAME, 'runmq.e2e.ad.played', MessageTestUtils.buffer(MessageExample.person()))
            await ChannelTestHelpers.assertQueueMessageCount(channel, ConsumerCreatorUtils.getDLQTopicName(configuration.name), 1)
            await ChannelTestHelpers.assertQueueMessageCount(channel, configuration.name, 0)
            await ChannelTestHelpers.assertQueueMessageCount(channel, ConsumerCreatorUtils.getRetryDelayTopicName(configuration.name), 0)

            // Direct-to-DLQ path: the user handler is never reached and the
            // retry pipeline is never engaged, so neither the per-attempt
            // failure log nor the max-retries log should appear.
            expect(handlerCalls).toBe(0);
            await LoggerTestHelpers.assertLoggedWithCount(MockedRunMQLogger.warn, 'Schema validation failed — routing message to DLQ.', 1)
            await LoggerTestHelpers.assertLoggedWithCount(MockedRunMQLogger.error, 'Message processing failed', 0)
            await LoggerTestHelpers.assertLoggedWithCount(MockedRunMQLogger.error, 'Message reached maximum attempts. Moving to dead-letter queue.', 0)
            await runMQ.disconnect();
            await testingConnection.disconnect();
        })
    })

    describe('publishing', () => {
        it('should publish and consume a message successfully', async () => {
            const configuration = RunMQProcessorConfigurationExample.simpleNoSchema()
            const testingConnection = new RabbitMQClientAdapter(validConfig);
            const channel = await testingConnection.getChannel();
            await ChannelTestHelpers.deleteQueue(channel, configuration.name);

            const runMQ = await RunMQ.start(validConfig, MockedRunMQLogger);
            const processedMessages: RunMQMessage[] = [];

            await runMQ.process<TestingMessage>("user.updated", configuration,
                (message): Promise<void> => {
                    processedMessages.push(message);
                    return Promise.resolve();
                }
            )

            const testMessage: TestingMessage = {name: "John Doe", age: 30};
            runMQ.publish("user.updated", testMessage);

            await ChannelTestHelpers.assertQueueMessageCount(channel, configuration.name, 0)
            await ChannelTestHelpers.assertQueueMessageCount(channel, ConsumerCreatorUtils.getDLQTopicName(configuration.name), 0)
            await ChannelTestHelpers.assertQueueMessageCount(channel, ConsumerCreatorUtils.getRetryDelayTopicName(configuration.name), 0)

            expect(processedMessages).toHaveLength(1);
            expect(processedMessages[0].message).toEqual(testMessage);

            await runMQ.disconnect();
            await testingConnection.disconnect();
        })

        it("should reject when publishing invalid message", async () => {
            const runMQ = await RunMQ.start(validConfig, MockedRunMQLogger);

            await expect(runMQ.publish("user.created", "invalid message" as any))
                .rejects.toThrow(RunMQException);

            await runMQ.disconnect();
        });
    })
});


interface TestingMessage {
    name: string;
    age: number;
}