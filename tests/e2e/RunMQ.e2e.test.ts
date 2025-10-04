import {RunMQ} from '@src/core/RunMQ';
import {RunMQException} from '@src/core/exceptions/RunMQException';
import {Exceptions} from '@src/core/exceptions/Exceptions';
import {AmqplibClient} from "@src/core/clients/AmqplibClient";
import {Constants} from "@src/core/constants";
import {RunMQMessage} from "@src/core/message/RunMQMessage";
import {ChannelTestHelpers} from "@tests/helpers/ChannelTestHelpers";
import {RunMQProcessorConfiguration} from "@src/types";
import {RunMQLogger} from "@src/core/logging/RunMQLogger";
import {LoggerTestHelpers} from "@tests/helpers/LoggerTestHelpers";
import {ConsumerCreatorUtils} from "@src/core/consumer/ConsumerCreatorUtils";

describe('RunMQ E2E Tests', () => {
    const validConfig = {
        url: 'amqp://test:test@localhost:5673',
        reconnectDelay: 100,
        maxReconnectAttempts: 3
    };

    const invalidConfig = {
        url: 'amqp://invalid:invalid@localhost:9999',
        reconnectDelay: 100,
        maxReconnectAttempts: 2
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

    describe('connection with retry logic', () => {
        it('should connect successfully on first attempt', async () => {
            const runMQ = await RunMQ.start(validConfig, mockedLogger);
            expect(runMQ.isActive()).toBe(true);
            await runMQ.disconnect();
        }, 15000);

        it('should retry and eventually fail with invalid config', async () => {
            const startTime = Date.now();
            await expect(RunMQ.start(invalidConfig, mockedLogger)).rejects.toThrow(RunMQException);
            const endTime = Date.now();

            // Should have taken at least the retry delay time
            expect(endTime - startTime).toBeGreaterThan(invalidConfig.reconnectDelay);

            try {
                await RunMQ.start(invalidConfig, mockedLogger);
            } catch (error) {
                expect(error).toBeInstanceOf(RunMQException);
                expect((error as RunMQException).exception).toBe(Exceptions.EXCEEDING_CONNECTION_ATTEMPTS);
                expect((error as RunMQException).details.attempts).toBe(invalidConfig.maxReconnectAttempts);
            }
        }, 20000);

        it('should connect after temporary network issues', async () => {
            await expect(RunMQ.start(invalidConfig, mockedLogger)).rejects.toThrow(RunMQException);

            const validRunMQ = await RunMQ.start(validConfig, mockedLogger);
            expect(validRunMQ.isActive()).toBe(true);
            await validRunMQ.disconnect();
        }, 25000);

        it('should handle disconnect properly', async () => {
            const runMQ = await RunMQ.start(validConfig, mockedLogger);
            expect(runMQ.isActive()).toBe(true);

            await runMQ.disconnect();
            expect(runMQ.isActive()).toBe(false);
        }, 15000);
    });

    describe('configuration handling', () => {
        it('should use default configuration values', async () => {
            const runMQ = await RunMQ.start({url: validConfig.url}, mockedLogger);
            expect(runMQ.isActive()).toBe(true);
            await runMQ.disconnect();
        }, 15000);

        it('should use custom configuration values', async () => {
            const customConfig = {
                url: validConfig.url,
                reconnectDelay: 50,
                maxReconnectAttempts: 1
            };
            const runMQ = await RunMQ.start(customConfig, mockedLogger);
            expect(runMQ.isActive()).toBe(true);
            await runMQ.disconnect();
        }, 15000);
    });

    describe('Initialization', () => {
        it('Should create the default router exchange on initialization', async () => {
            const runMQ = await RunMQ.start(validConfig, mockedLogger);
            const testingConnection = new AmqplibClient(validConfig);
            const channel = await testingConnection.getChannel();
            await channel.checkExchange(Constants.ROUTER_EXCHANGE_NAME);
            await channel.deleteExchange(Constants.ROUTER_EXCHANGE_NAME);
            await runMQ.disconnect();
        });
        it('should not throw error if router exchange is already created', async () => {
            await RunMQ.start(validConfig, mockedLogger);
            await RunMQ.start(validConfig, mockedLogger);
        });
    })

    describe('processing', () => {
        it('Should end up in DLQ when message is not meeting the schema validation', async () => {
            const configuration: RunMQProcessorConfiguration = {
                name: "createInElasticSearchOnAdPlayed",
                maxRetries: 3,
                consumersCount: 1,
                retryDelay: 100,
            }

            const testingConnection = new AmqplibClient(validConfig);
            const channel = await testingConnection.getChannel();
            await ChannelTestHelpers.deleteQueue(channel, configuration.name);

            const runMQ = await RunMQ.start(validConfig, mockedLogger);

            await runMQ.process<TestingMessage>("ad.played", configuration,
                (message: RunMQMessage<TestingMessage>) => {
                    console.log("Processing message", message);
                    return;
                }
            )

            channel.publish(Constants.ROUTER_EXCHANGE_NAME, 'ad.played', Buffer.from(JSON.stringify({
                    message: {
                        name: "Test Ad",
                        age: 5
                    }
                }))
            )
            await ChannelTestHelpers.assertQueueMessageCount(channel, ConsumerCreatorUtils.getDLQTopicName(configuration.name), 1)
            await ChannelTestHelpers.assertQueueMessageCount(channel, configuration.name, 0)
            await ChannelTestHelpers.assertQueueMessageCount(channel, ConsumerCreatorUtils.getRetryDelayTopicName(configuration.name), 0)

            await LoggerTestHelpers.assertLoggedWithCount(mockedLogger.error, 'Message processing failed', configuration.maxRetries as number)
            await LoggerTestHelpers.assertLoggedWithCountAndParameters(mockedLogger.error, 'Message reached maximum retries. Moving to dead-letter queue.', {
                    retries: configuration.maxRetries,
                    max: configuration.maxRetries,
                },
                1
            )
        })
    })
});


interface TestingMessage {
    name: string;
    age: number;
}