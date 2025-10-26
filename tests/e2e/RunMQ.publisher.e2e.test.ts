import {RunMQ} from '@src/core/RunMQ';
import {AmqplibClient} from "@src/core/clients/AmqplibClient";
import {Constants} from "@src/core/constants";
import {ChannelTestHelpers} from "@tests/helpers/ChannelTestHelpers";
import {ConsumerCreatorUtils} from "@src/core/consumer/ConsumerCreatorUtils";
import {RunMQProcessorConfigurationExample} from "@tests/Examples/RunMQProcessorConfigurationExample";
import {MockedRunMQLogger} from "@tests/mocks/MockedRunMQLogger";
import {RunMQConnectionConfigExample} from "@tests/Examples/RunMQConnectionConfigExample";
import {RunMQMessageExample} from "@tests/Examples/RunMQMessageExample";

describe('RunMQ Publisher E2E Tests', () => {
    const validConfig = RunMQConnectionConfigExample.valid();
    const configuration= RunMQProcessorConfigurationExample.simpleNoSchema()

    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('publish functionality', () => {
        it('should publish message successfully to the correct queue', async () => {
            const testingConnection = new AmqplibClient(validConfig);
            const channel = await testingConnection.getChannel();
            await ChannelTestHelpers.deleteQueue(channel, configuration.name);

            const runMQ = await RunMQ.start(validConfig, MockedRunMQLogger);

            await channel.assertQueue(configuration.name, {
                durable: true,
                deadLetterExchange: Constants.DEAD_LETTER_ROUTER_EXCHANGE_NAME,
                deadLetterRoutingKey: configuration.name
            });
            await channel.bindQueue(configuration.name, Constants.ROUTER_EXCHANGE_NAME, "test.publish.topic");

            const testMessage = RunMQMessageExample.random();

            runMQ.publish("test.publish.topic", testMessage);

            await new Promise(resolve => setTimeout(resolve, 100));

            await ChannelTestHelpers.assertQueueMessageCount(channel, configuration.name, 1);

            await runMQ.disconnect();
            await testingConnection.disconnect();
        }, 15000);

        it('should publish multiple messages successfully', async () => {
            const testingConnection = new AmqplibClient(validConfig);
            const channel = await testingConnection.getChannel();
            await ChannelTestHelpers.deleteQueue(channel, configuration.name);

            const runMQ = await RunMQ.start(validConfig, MockedRunMQLogger);

            await channel.assertQueue(configuration.name, {
                durable: true,
                deadLetterExchange: Constants.DEAD_LETTER_ROUTER_EXCHANGE_NAME,
                deadLetterRoutingKey: configuration.name
            });
            await channel.bindQueue(configuration.name, Constants.ROUTER_EXCHANGE_NAME, "test.multiple.topic");

            const messageCount = 5;
            for (let i = 0; i < messageCount; i++) {
                const testMessage = RunMQMessageExample.random();
                runMQ.publish("test.multiple.topic", testMessage);
            }

            await new Promise(resolve => setTimeout(resolve, 100));

            await ChannelTestHelpers.assertQueueMessageCount(channel, configuration.name, messageCount);

            await runMQ.disconnect();
            await testingConnection.disconnect();
        }, 15000);

        it('should handle publishing to non-existent topic gracefully', async () => {
            const testingConnection = new AmqplibClient(validConfig);
            const channel = await testingConnection.getChannel();
            await ChannelTestHelpers.deleteQueue(channel, configuration.name);

            const runMQ = await RunMQ.start(validConfig, MockedRunMQLogger);

            await runMQ.process<TestMessage>("existing.topic", configuration,
                (message): Promise<void> => {
                    return Promise.resolve();
                }
            )

            const testMessage = RunMQMessageExample.random();

            runMQ.publish("non.existent.topic", testMessage);

            await ChannelTestHelpers.assertQueueMessageCount(channel, configuration.name, 0);
            await ChannelTestHelpers.assertQueueMessageCount(channel, ConsumerCreatorUtils.getDLQTopicName(configuration.name), 0);
            await ChannelTestHelpers.assertQueueMessageCount(channel, ConsumerCreatorUtils.getRetryDelayTopicName(configuration.name), 0);

            await runMQ.disconnect();
            await testingConnection.disconnect();
        }, 15000);

        it('should publish message with proper RunMQMessage structure', async () => {
            const testingConnection = new AmqplibClient(validConfig);
            const channel = await testingConnection.getChannel();
            await ChannelTestHelpers.deleteQueue(channel, configuration.name);

            const runMQ = await RunMQ.start(validConfig, MockedRunMQLogger);

            await channel.assertQueue(configuration.name, {
                durable: true,
                deadLetterExchange: Constants.DEAD_LETTER_ROUTER_EXCHANGE_NAME,
                deadLetterRoutingKey: configuration.name
            });
            await channel.bindQueue(configuration.name, Constants.ROUTER_EXCHANGE_NAME, "test.structure.topic");

            const testMessage = RunMQMessageExample.random();

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
