import {RunMQ} from '@src/core/RunMQ';
import {AmqplibClient} from "@src/core/clients/AmqplibClient";
import {Constants} from "@src/core/constants";
import {ChannelTestHelpers} from "@tests/helpers/ChannelTestHelpers";
import {ConsumerCreatorUtils} from "@src/core/consumer/ConsumerCreatorUtils";
import {RunMQUtils} from "@src/core/utils/Utils";
import {MockedRunMQLogger} from "@tests/mocks/MockedRunMQLogger";
import {RunMQConnectionConfigExample} from "@tests/Examples/RunMQConnectionConfigExample";
import {RunMQProcessorConfigurationExample} from "@tests/Examples/RunMQProcessorConfigurationExample";
import {RunMQMessageExample} from "@tests/Examples/RunMQMessageExample";
import {MessageTestUtils} from "@tests/helpers/MessageTestUtils";

describe('RunMQ E2E Tests', () => {
    const validConfig = RunMQConnectionConfigExample.valid();

    beforeEach(() => {
        jest.clearAllMocks();
    });

    const testingConnection = new AmqplibClient(validConfig);

    describe('processing behaviours', () => {
        it('Should process the message correctly given valid RunMQMessage structure without schema', async () => {
            const configuration = RunMQProcessorConfigurationExample.simpleNoSchema()

            const channel = await testingConnection.getChannel();
            await ChannelTestHelpers.deleteQueue(channel, configuration.name);

            const runMQ = await RunMQ.start(validConfig, MockedRunMQLogger);
            let counter = 0;
            await runMQ.process<TestingMessage>("ad.played", configuration,
                () => {
                    counter++;
                    return Promise.resolve();
                }
            )

            channel.publish(Constants.ROUTER_EXCHANGE_NAME, 'ad.played', MessageTestUtils.buffer(RunMQMessageExample.random()))

            await RunMQUtils.delay(500);
            expect(counter).toBe(1);
            await ChannelTestHelpers.assertQueueMessageCount(channel, ConsumerCreatorUtils.getDLQTopicName(configuration.name), 0)
            await ChannelTestHelpers.assertQueueMessageCount(channel, configuration.name, 0)
            await ChannelTestHelpers.assertQueueMessageCount(channel, ConsumerCreatorUtils.getRetryDelayTopicName(configuration.name), 0)
            await runMQ.disconnect();
            await testingConnection.disconnect();
        })

        it('Should process the message correctly given valid RunMQMessage structure with schema', async () => {
            const configuration = RunMQProcessorConfigurationExample.simpleWithPersonSchema();

            const channel = await testingConnection.getChannel();
            await ChannelTestHelpers.deleteQueue(channel, configuration.name);

            const runMQ = await RunMQ.start(validConfig, MockedRunMQLogger);
            let counter = 0;
            await runMQ.process<TestingMessage>("user.created", configuration,
                () => {
                    counter++;
                    return Promise.resolve();
                }
            )

            channel.publish(Constants.ROUTER_EXCHANGE_NAME, 'user.created', MessageTestUtils.buffer(RunMQMessageExample.person()))

            await RunMQUtils.delay(500);
            expect(counter).toBe(1);
            await ChannelTestHelpers.assertQueueMessageCount(channel, ConsumerCreatorUtils.getDLQTopicName(configuration.name), 0)
            await ChannelTestHelpers.assertQueueMessageCount(channel, configuration.name, 0)
            await ChannelTestHelpers.assertQueueMessageCount(channel, ConsumerCreatorUtils.getRetryDelayTopicName(configuration.name), 0)
            await runMQ.disconnect();
            await testingConnection.disconnect();
        })

        it('Should should process up to attempts even if retry delay is not specified', async () => {
            const configuration = RunMQProcessorConfigurationExample.simpleWithPersonSchema(2);


            const channel = await testingConnection.getChannel();
            await ChannelTestHelpers.deleteQueue(channel, configuration.name);

            const runMQ = await RunMQ.start(validConfig, MockedRunMQLogger);
            let attemptCount = 0;
            await runMQ.process<TestingMessage>("user.created", configuration,
                () => {
                    attemptCount++;
                    throw new Error("Processing failed");
                }
            )

            channel.publish(Constants.ROUTER_EXCHANGE_NAME, 'user.created', MessageTestUtils.buffer(RunMQMessageExample.person()))


            await RunMQUtils.delay(500);
            expect(attemptCount).toBe(2);

            await ChannelTestHelpers.assertQueueMessageCount(channel, ConsumerCreatorUtils.getDLQTopicName(configuration.name), 1)
            await ChannelTestHelpers.assertQueueMessageCount(channel, configuration.name, 0)
            await ChannelTestHelpers.assertQueueMessageCount(channel, ConsumerCreatorUtils.getRetryDelayTopicName(configuration.name), 0)
            await runMQ.disconnect();
            await testingConnection.disconnect();
        })

        it('Should try processing only once if attempts is one', async () => {
            const configuration = RunMQProcessorConfigurationExample.simpleWithPersonSchema(1);


            const channel = await testingConnection.getChannel();
            await ChannelTestHelpers.deleteQueue(channel, configuration.name);

            const runMQ = await RunMQ.start(validConfig, MockedRunMQLogger);
            let attemptCount = 0;
            await runMQ.process<TestingMessage>("user.created", configuration,
                () => {
                    attemptCount++;
                    throw new Error("Processing failed");
                }
            )

            channel.publish(Constants.ROUTER_EXCHANGE_NAME, 'user.created', MessageTestUtils.buffer(RunMQMessageExample.person()))


            await RunMQUtils.delay(500);
            expect(attemptCount).toBe(1);

            await ChannelTestHelpers.assertQueueMessageCount(channel, ConsumerCreatorUtils.getDLQTopicName(configuration.name), 1)
            await ChannelTestHelpers.assertQueueMessageCount(channel, configuration.name, 0)
            await ChannelTestHelpers.assertQueueMessageCount(channel, ConsumerCreatorUtils.getRetryDelayTopicName(configuration.name), 0)
            await runMQ.disconnect();
            await testingConnection.disconnect();
        })

        it('Should retry processing errors up to attempts before sending to DLQ', async () => {
            const configuration = RunMQProcessorConfigurationExample.simpleWithPersonSchema(2);


            const channel = await testingConnection.getChannel();
            await ChannelTestHelpers.deleteQueue(channel, configuration.name);

            const runMQ = await RunMQ.start(validConfig, MockedRunMQLogger);
            let attemptCount = 0;
            await runMQ.process<TestingMessage>("user.created", configuration,
                () => {
                    attemptCount++;
                    throw new Error("Processing failed");
                }
            )

            channel.publish(Constants.ROUTER_EXCHANGE_NAME, 'user.created', MessageTestUtils.buffer(RunMQMessageExample.person()))


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
            const configuration = RunMQProcessorConfigurationExample.simpleNoSchema();

            const channel = await testingConnection.getChannel();
            await ChannelTestHelpers.deleteQueue(channel, configuration.name);

            const runMQ = await RunMQ.start(validConfig, MockedRunMQLogger);
            let processorCalled = false;
            await runMQ.process<TestingMessage>("user.malformed", configuration,
                () => {
                    processorCalled = true;
                    return Promise.resolve();
                }
            )

            channel.publish(Constants.ROUTER_EXCHANGE_NAME, 'user.malformed', Buffer.from("{invalid json}"))

            await RunMQUtils.delay(500);
            expect(processorCalled).toBe(false);

            await ChannelTestHelpers.assertQueueMessageCount(channel, ConsumerCreatorUtils.getDLQTopicName(configuration.name), 1)
            await ChannelTestHelpers.assertQueueMessageCount(channel, configuration.name, 0)
            await runMQ.disconnect();
            await testingConnection.disconnect();
        })

        it('Should respect retry delay timing between attempts', async () => {
            const configuration = RunMQProcessorConfigurationExample.random(
                "timingTestConsumer",
                1,
                3,
                300
            );


            const channel = await testingConnection.getChannel();
            await ChannelTestHelpers.deleteQueue(channel, configuration.name);

            const runMQ = await RunMQ.start(validConfig, MockedRunMQLogger);
            const attemptTimestamps: number[] = [];
            await runMQ.process<TestingMessage>("user.created", configuration,
                () => {
                    attemptTimestamps.push(Date.now());
                    if (attemptTimestamps.length < 3) {
                        throw new Error("Retry me");
                    }
                    return Promise.resolve();
                }
            )

            channel.publish(Constants.ROUTER_EXCHANGE_NAME, 'user.created', MessageTestUtils.buffer(RunMQMessageExample.person()))

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
            const configuration = RunMQProcessorConfigurationExample.simpleNoSchema();

            const channel = await testingConnection.getChannel();
            await ChannelTestHelpers.deleteQueue(channel, configuration.name);

            const runMQ = await RunMQ.start(validConfig, MockedRunMQLogger);
            const processedMessages = new Set<string>();
            let processingCount = 0;

            await runMQ.process<TestingMessage>("user.created", configuration,
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
                channel.publish(Constants.ROUTER_EXCHANGE_NAME, 'user.created', MessageTestUtils.buffer(RunMQMessageExample.random()))
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