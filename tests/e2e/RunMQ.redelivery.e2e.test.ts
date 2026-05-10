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
 * Integration tests that verify RunMQ's behaviour when ack/nack plumbing
 * fails (e.g. channel closed mid-flight).
 *
 * Regressions guarded:
 *   #20 — async errors from the consume callback must not become
 *         unhandled promise rejections (would crash on Node 15+).
 *   #21 — message.ack()/nack() throws must not propagate; the broker
 *         redelivers unacked messages on channel close anyway, so
 *         escalating only crashes the consumer for no recovery benefit.
 */
describe('RunMQ Redelivery & Failure-Handling E2E', () => {
    const validConfig = RunMQConnectionConfigExample.valid();

    beforeEach(() => {
        jest.clearAllMocks();
        jest.restoreAllMocks();
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it('does not crash the consumer when ack() throws (channel-closed simulation)', async () => {
        const configuration = RunMQProcessorConfigurationExample.simpleNoSchema('redelivery_ack_throws');

        const testingConnection = new RabbitMQClientAdapter(validConfig);
        const channel = await testingConnection.getChannel();
        await ChannelTestHelpers.deleteQueue(channel, configuration.name);

        // Capture any unhandled rejections so we can assert none fire.
        const unhandled: unknown[] = [];
        const onUnhandled = (e: unknown) => unhandled.push(e);
        process.on('unhandledRejection', onUnhandled);

        // Force every ack on a RabbitMQClientChannel to throw, simulating a
        // channel that has closed between the handler and the ack call.
        const ackSpy = jest.spyOn(RabbitMQClientChannel.prototype, 'ack')
            .mockImplementation(() => { throw new Error('channel closed (simulated)'); });

        try {
            const runMQ = await RunMQ.start(validConfig, MockedRunMQLogger);
            let handlerCalls = 0;
            await runMQ.process('redelivery.ack', configuration, () => {
                handlerCalls++;
                return Promise.resolve();
            });

            const messageCount = 3;
            for (let i = 0; i < messageCount; i++) {
                channel.publish(
                    Constants.ROUTER_EXCHANGE_NAME,
                    'redelivery.ack',
                    MessageTestUtils.buffer(RunMQMessageExample.random()),
                );
            }

            await RunMQUtils.delay(800);

            // Handler must have been invoked for every message — proving the
            // consumer kept running despite ack throwing every time.
            expect(handlerCalls).toBe(messageCount);

            // ack must have been attempted exactly once per message.
            expect(ackSpy).toHaveBeenCalledTimes(messageCount);

            // Crucially: no unhandled rejections from the consume callback.
            expect(unhandled).toEqual([]);

            await runMQ.disconnect();
        } finally {
            process.off('unhandledRejection', onUnhandled);
            await testingConnection.disconnect();
        }
    });

    it('does not crash the consumer when nack() throws (channel-closed simulation)', async () => {
        const configuration = RunMQProcessorConfigurationExample.simpleNoSchema('redelivery_nack_throws');

        const testingConnection = new RabbitMQClientAdapter(validConfig);
        const channel = await testingConnection.getChannel();
        await ChannelTestHelpers.deleteQueue(channel, configuration.name);

        const unhandled: unknown[] = [];
        const onUnhandled = (e: unknown) => unhandled.push(e);
        process.on('unhandledRejection', onUnhandled);

        const nackSpy = jest.spyOn(RabbitMQClientChannel.prototype, 'nack')
            .mockImplementation(() => { throw new Error('channel closed (simulated)'); });

        try {
            const runMQ = await RunMQ.start(validConfig, MockedRunMQLogger);
            let handlerCalls = 0;
            await runMQ.process('redelivery.nack', configuration, () => {
                handlerCalls++;
                throw new Error('handler intentionally fails');
            });

            channel.publish(
                Constants.ROUTER_EXCHANGE_NAME,
                'redelivery.nack',
                MessageTestUtils.buffer(RunMQMessageExample.random()),
            );

            await RunMQUtils.delay(800);

            // Handler ran at least once; nack was attempted; no crash.
            expect(handlerCalls).toBeGreaterThanOrEqual(1);
            expect(nackSpy).toHaveBeenCalled();
            expect(unhandled).toEqual([]);

            await runMQ.disconnect();
        } finally {
            process.off('unhandledRejection', onUnhandled);
            await testingConnection.disconnect();
        }
    });

    it('redelivers unacked messages after a consumer disconnects mid-processing', async () => {
        const configuration = RunMQProcessorConfigurationExample.simpleNoSchema('redelivery_disconnect');

        const testingConnection = new RabbitMQClientAdapter(validConfig);
        const channel = await testingConnection.getChannel();
        await ChannelTestHelpers.deleteQueue(channel, configuration.name);

        // First consumer: hangs forever so the message stays unacked.
        const firstRunMQ = await RunMQ.start(validConfig, MockedRunMQLogger);
        let firstReceived = 0;
        await firstRunMQ.process('redelivery.disconnect', configuration, () => {
            firstReceived++;
            return new Promise<void>(() => { /* never resolve */ });
        });

        channel.publish(
            Constants.ROUTER_EXCHANGE_NAME,
            'redelivery.disconnect',
            MessageTestUtils.buffer(RunMQMessageExample.random()),
        );

        // Wait for the message to reach the handler (and stay unacked).
        await RunMQUtils.delay(400);
        expect(firstReceived).toBe(1);

        // Disconnect — the broker now considers the message un-acked and will
        // requeue it for the next consumer.
        await firstRunMQ.disconnect();

        // Second consumer on the same processor name — must receive the
        // redelivered message.
        const secondRunMQ = await RunMQ.start(validConfig, MockedRunMQLogger);
        let secondReceived = 0;
        await secondRunMQ.process('redelivery.disconnect', configuration, () => {
            secondReceived++;
            return Promise.resolve();
        });

        await RunMQUtils.delay(800);
        expect(secondReceived).toBe(1);

        await ChannelTestHelpers.assertQueueMessageCount(channel, configuration.name, 0);
        await ChannelTestHelpers.assertQueueMessageCount(channel, ConsumerCreatorUtils.getDLQTopicName(configuration.name), 0);

        await secondRunMQ.disconnect();
        await testingConnection.disconnect();
    });
});
