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
                name: "createInElasticSearchOnAdPlayed",
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
                    return;
                }
            )

            channel.publish(Constants.ROUTER_EXCHANGE_NAME, 'ad.played', Buffer.from(JSON.stringify({
                    message: {
                        name: "Test Ad",
                        value: 5
                    },
                    meta: {
                        id: "123",
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
        })

        it('Should process the message correctly given valid RunMQMessage structure with schema', async () => {
            class TestData {
                name!: string;
                value!: number;
            };
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
                    return;
                }
            )

            channel.publish(Constants.ROUTER_EXCHANGE_NAME, 'ad.played', Buffer.from(JSON.stringify({
                    message: {
                        name: "Test Ad",
                        value: 5
                    },
                    meta: {
                        id: "123",
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
        })
    })
});


interface TestingMessage {
    name: string;
    age: number;
}