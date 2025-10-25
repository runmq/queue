import {RunMQ} from '@src/core/RunMQ';
import {AmqplibClient} from "@src/core/clients/AmqplibClient";
import {Constants} from "@src/core/constants";
import {ChannelTestHelpers} from "@tests/helpers/ChannelTestHelpers";
import {RunMQProcessorConfiguration} from "@src/types";
import {RunMQLogger} from "@src/core/logging/RunMQLogger";
import {ConsumerCreatorUtils} from "@src/core/consumer/ConsumerCreatorUtils";

describe('RunMQ Publisher E2E Tests', () => {
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

    describe('publish functionality', () => {
        it('should publish message successfully to the correct queue', async () => {
            const configuration: RunMQProcessorConfiguration = {
                name: "testPublisherQueue",
                maxRetries: 3,
                consumersCount: 1,
                retryDelay: 100,
            }

            const testingConnection = new AmqplibClient(validConfig);
            const channel = await testingConnection.getChannel();
            await ChannelTestHelpers.deleteQueue(channel, configuration.name);

            const runMQ = await RunMQ.start(validConfig, mockedLogger);
            
            await channel.assertQueue(configuration.name, {
                durable: true,
                deadLetterExchange: Constants.DEAD_LETTER_ROUTER_EXCHANGE_NAME,
                deadLetterRoutingKey: configuration.name
            });
            await channel.bindQueue(configuration.name, Constants.ROUTER_EXCHANGE_NAME, "test.publish.topic");

            const testMessage = {
                name: "Test Message",
                value: 42,
                timestamp: Date.now()
            };
            
            runMQ.publish("test.publish.topic", testMessage);

            await new Promise(resolve => setTimeout(resolve, 100));

            await ChannelTestHelpers.assertQueueMessageCount(channel, configuration.name, 1);

            await runMQ.disconnect();
            await testingConnection.disconnect();
        }, 15000);

        it('should publish multiple messages successfully', async () => {
            const configuration: RunMQProcessorConfiguration = {
                name: "testMultiplePublisherQueue",
                maxRetries: 3,
                consumersCount: 1,
                retryDelay: 100,
            }

            const testingConnection = new AmqplibClient(validConfig);
            const channel = await testingConnection.getChannel();
            await ChannelTestHelpers.deleteQueue(channel, configuration.name);

            const runMQ = await RunMQ.start(validConfig, mockedLogger);
            
            await channel.assertQueue(configuration.name, {
                durable: true,
                deadLetterExchange: Constants.DEAD_LETTER_ROUTER_EXCHANGE_NAME,
                deadLetterRoutingKey: configuration.name
            });
            await channel.bindQueue(configuration.name, Constants.ROUTER_EXCHANGE_NAME, "test.multiple.topic");

            const messageCount = 5;
            for (let i = 0; i < messageCount; i++) {
                const testMessage = {
                    name: `Test Message ${i}`,
                    value: i,
                    timestamp: Date.now()
                };
                runMQ.publish("test.multiple.topic", testMessage);
            }

            await new Promise(resolve => setTimeout(resolve, 100));

            await ChannelTestHelpers.assertQueueMessageCount(channel, configuration.name, messageCount);

            await runMQ.disconnect();
            await testingConnection.disconnect();
        }, 15000);

        it('should handle publishing to non-existent topic gracefully', async () => {
            const configuration: RunMQProcessorConfiguration = {
                name: "testNonExistentTopicQueue",
                maxRetries: 3,
                consumersCount: 1,
                retryDelay: 100,
            }

            const testingConnection = new AmqplibClient(validConfig);
            const channel = await testingConnection.getChannel();
            await ChannelTestHelpers.deleteQueue(channel, configuration.name);

            const runMQ = await RunMQ.start(validConfig, mockedLogger);
            
            await runMQ.process<TestMessage>("existing.topic", configuration,
                (message): Promise<void> => {
                    return Promise.resolve();
                }
            )

            const testMessage = {
                name: "Test Message",
                value: 42
            };
            
            runMQ.publish("non.existent.topic", testMessage);

            await ChannelTestHelpers.assertQueueMessageCount(channel, configuration.name, 0);
            await ChannelTestHelpers.assertQueueMessageCount(channel, ConsumerCreatorUtils.getDLQTopicName(configuration.name), 0);
            await ChannelTestHelpers.assertQueueMessageCount(channel, ConsumerCreatorUtils.getRetryDelayTopicName(configuration.name), 0);

            await runMQ.disconnect();
            await testingConnection.disconnect();
        }, 15000);

        it('should publish message with proper RunMQMessage structure', async () => {
            const configuration: RunMQProcessorConfiguration = {
                name: "testMessageStructureQueue",
                maxRetries: 3,
                consumersCount: 1,
                retryDelay: 100,
            }

            const testingConnection = new AmqplibClient(validConfig);
            const channel = await testingConnection.getChannel();
            await ChannelTestHelpers.deleteQueue(channel, configuration.name);

            const runMQ = await RunMQ.start(validConfig, mockedLogger);
            
            await channel.assertQueue(configuration.name, {
                durable: true,
                deadLetterExchange: Constants.DEAD_LETTER_ROUTER_EXCHANGE_NAME,
                deadLetterRoutingKey: configuration.name
            });
            await channel.bindQueue(configuration.name, Constants.ROUTER_EXCHANGE_NAME, "test.structure.topic");

            const testMessage = {
                name: "Structure Test Message",
                value: 123
            };
            
            runMQ.publish("test.structure.topic", testMessage);

            await new Promise(resolve => setTimeout(resolve, 100));

            await ChannelTestHelpers.assertQueueMessageCount(channel, configuration.name, 1);

            await runMQ.disconnect();
            await testingConnection.disconnect();
        }, 15000);
    });
});

interface TestMessage {
    name: string;
    value: number;
    timestamp?: number;
}
