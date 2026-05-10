import {RunMQ} from '@src/core/RunMQ';
import {RabbitMQClientAdapter} from "@src/core/clients/RabbitMQClientAdapter";
import {RabbitMQClientChannel} from "@src/core/clients/RabbitMQClientChannel";
import {Constants} from "@src/core/constants";
import {ChannelTestHelpers} from "@tests/helpers/ChannelTestHelpers";
import {ConsumerCreatorUtils} from "@src/core/consumer/ConsumerCreatorUtils";
import {RunMQUtils} from "@src/core/utils/RunMQUtils";
import {MockedRunMQLogger} from "@tests/mocks/MockedRunMQLogger";
import {RunMQConnectionConfigExample} from "@tests/Examples/RunMQConnectionConfigExample";
import {RunMQProcessorConfigurationExample} from "@tests/Examples/RunMQProcessorConfigurationExample";
import {RunMQMessageExample} from "@tests/Examples/RunMQMessageExample";
import {MessageTestUtils} from "@tests/helpers/MessageTestUtils";

/**
 * Integration tests for issues #19 + #28: publisher confirms.
 *
 * Before this fix, DLQ publishes from RunMQRetriesCheckerProcessor were
 * fire-and-forget — the message was ack'd immediately even if the DLQ
 * publish silently failed. That meant a network blip during a
 * retry-exhausted message's DLQ handoff resulted in permanent message loss.
 *
 * The fix: enable publisher confirms on the consumer channel and await the
 * DLQ publish. On failure, nack(false) so the message goes back through the
 * retry pipeline (with natural backoff via the retry-delay queue's TTL) and
 * gets another shot at reaching the DLQ.
 */
describe('RunMQ DLQ Publisher Confirms E2E', () => {
    const validConfig = RunMQConnectionConfigExample.valid();

    beforeEach(() => {
        jest.restoreAllMocks();
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it('does not lose the message when the DLQ publish fails — message is redelivered', async () => {
        const configuration = RunMQProcessorConfigurationExample.simpleNoSchema('dlq_confirm_redeliver');

        const testingConnection = new RabbitMQClientAdapter(validConfig);
        const channel = await testingConnection.getChannel();
        await ChannelTestHelpers.deleteQueue(channel, configuration.name);

        const runMQ = await RunMQ.start(validConfig, MockedRunMQLogger);
        let handlerCalls = 0;
        await runMQ.process('dlq.confirm', configuration, () => {
            handlerCalls++;
            throw new Error('handler intentionally fails');
        });

        // Make the FIRST DLQ publish fail (simulating broker rejection or
        // channel closure mid-flight). Subsequent publishes succeed.
        // This is the scenario where the old code silently lost messages.
        let dlqPublishesAttempted = 0;
        const original = RabbitMQClientChannel.prototype.publish;
        jest.spyOn(RabbitMQClientChannel.prototype, 'publish')
            .mockImplementation(async function (this: RabbitMQClientChannel, exchange: string, routingKey: string, content: Buffer, options) {
                if (exchange === Constants.DEAD_LETTER_ROUTER_EXCHANGE_NAME) {
                    dlqPublishesAttempted++;
                    if (dlqPublishesAttempted === 1) {
                        throw new Error('simulated broker rejection on first DLQ publish');
                    }
                }
                return original.call(this, exchange, routingKey, content, options);
            });

        try {
            // Publish a message. Handler fails on first delivery → DLQ publish
            // attempts → first publish fails → message is nacked back into the
            // retry pipeline → retry-delay TTL → handler fails again → DLQ
            // publish succeeds → message lands in DLQ.
            channel.publish(
                Constants.ROUTER_EXCHANGE_NAME,
                'dlq.confirm',
                MessageTestUtils.buffer(RunMQMessageExample.random()),
            );

            // Default attemptsDelay is 100ms (simpleNoSchema config).
            // We need: handler call, DLQ publish fail, retry-delay wait, handler call, DLQ publish succeeds.
            await RunMQUtils.delay(2000);

            // Both DLQ publish attempts were made (first failed, second succeeded).
            expect(dlqPublishesAttempted).toBeGreaterThanOrEqual(2);
            // Handler ran multiple times due to redelivery — proves the message
            // was nack'd back, NOT silently dropped.
            expect(handlerCalls).toBeGreaterThanOrEqual(2);
            // Message landed in DLQ on the second attempt.
            await ChannelTestHelpers.assertQueueMessageCount(channel, ConsumerCreatorUtils.getDLQTopicName(configuration.name), 1);
            // Main queue is empty.
            await ChannelTestHelpers.assertQueueMessageCount(channel, configuration.name, 0);
        } finally {
            await runMQ.disconnect();
            await testingConnection.disconnect();
        }
    });

    it('confirms DLQ publishes by default — broker ack required before original is acked', async () => {
        const configuration = RunMQProcessorConfigurationExample.random(
            'dlq_confirm_happy_path',
            1,
            1,    // attempts=1, so first failure → DLQ
            100,
        );

        const testingConnection = new RabbitMQClientAdapter(validConfig);
        const channel = await testingConnection.getChannel();
        await ChannelTestHelpers.deleteQueue(channel, configuration.name);

        const runMQ = await RunMQ.start(validConfig, MockedRunMQLogger);
        await runMQ.process('dlq.happy', configuration, () => {
            throw new Error('handler always fails');
        });

        channel.publish(
            Constants.ROUTER_EXCHANGE_NAME,
            'dlq.happy',
            MessageTestUtils.buffer(RunMQMessageExample.random()),
        );

        await RunMQUtils.delay(500);

        // Message should be in DLQ (with confirm received from broker).
        await ChannelTestHelpers.assertQueueMessageCount(channel, ConsumerCreatorUtils.getDLQTopicName(configuration.name), 1);
        await ChannelTestHelpers.assertQueueMessageCount(channel, configuration.name, 0);
        await ChannelTestHelpers.assertQueueMessageCount(channel, ConsumerCreatorUtils.getRetryDelayTopicName(configuration.name), 0);

        await runMQ.disconnect();
        await testingConnection.disconnect();
    });
});
