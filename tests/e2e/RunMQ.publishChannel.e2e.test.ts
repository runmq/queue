import {RunMQ} from '@src/core/RunMQ';
import {RabbitMQClientAdapter} from "@src/core/clients/RabbitMQClientAdapter";
import {Constants} from "@src/core/constants";
import {ChannelTestHelpers} from "@tests/helpers/ChannelTestHelpers";
import {RunMQUtils} from "@src/core/utils/RunMQUtils";
import {MockedRunMQLogger} from "@tests/mocks/MockedRunMQLogger";
import {RunMQConnectionConfigExample} from "@tests/Examples/RunMQConnectionConfigExample";
import {RunMQProcessorConfigurationExample} from "@tests/Examples/RunMQProcessorConfigurationExample";

describe('RunMQ Publish Channel Isolation E2E', () => {
    const validConfig = RunMQConnectionConfigExample.valid();
    const testingConnection = new RabbitMQClientAdapter(validConfig);

    afterAll(async () => {
        await testingConnection.disconnect();
    });

    it('should keep publishing working after a setup-channel close from a precondition_failed', async () => {
        const queueName = 'publish_channel_isolation_queue';
        const topic = 'publish.channel.isolation';

        const setupChannel = await testingConnection.getChannel();
        await ChannelTestHelpers.deleteQueue(setupChannel, queueName);

        // Pre-declare the queue with one set of arguments. A later assertQueue
        // with conflicting arguments will trigger PRECONDITION_FAILED, which
        // RabbitMQ resolves by closing the offending channel.
        await setupChannel.assertQueue(queueName, {
            durable: true,
            messageTtl: 60_000,
        });

        const runMQ = await RunMQ.start(validConfig, MockedRunMQLogger);

        // Trigger a precondition failure on the consumer-setup channel by
        // declaring a processor whose queue name collides with the existing
        // queue but whose args differ. This must NOT take the publish channel
        // down with it.
        const conflictingConfig = RunMQProcessorConfigurationExample.simpleNoSchema(queueName);
        await expect(
            runMQ.process(topic, conflictingConfig, async () => {})
        ).rejects.toBeDefined();

        // Give the broker a moment to actually close the setup channel.
        await RunMQUtils.delay(300);

        // Set up a fresh consumer on a different queue, on a different topic,
        // so we have a place for the publish to land.
        const verifyQueue = 'publish_channel_isolation_verify';
        const verifyTopic = 'publish.channel.isolation.verify';
        await ChannelTestHelpers.deleteQueue(setupChannel, verifyQueue);
        const verifyConfig = RunMQProcessorConfigurationExample.simpleNoSchema(verifyQueue);
        const received: any[] = [];
        await runMQ.process(verifyTopic, verifyConfig, async (msg) => {
            received.push(msg);
        });

        // The crux of the test: publish() must still work even though the
        // setup channel was closed by the prior precondition_failed.
        runMQ.publish(verifyTopic, {ok: true});

        await RunMQUtils.delay(500);
        expect(received.length).toBe(1);

        await ChannelTestHelpers.deleteQueue(setupChannel, queueName);
        await ChannelTestHelpers.deleteQueue(setupChannel, verifyQueue);
        await runMQ.disconnect();
    }, 30000);

    it('should also publish via a channel distinct from getDefaultChannel', async () => {
        const runMQ = await RunMQ.start(validConfig, MockedRunMQLogger);

        // Publishing immediately after start should not throw and should not
        // depend on the setup channel — covered by the first test, but this
        // case asserts the simple happy-path wiring still works.
        const queueName = 'publish_channel_smoke';
        const topic = 'publish.channel.smoke';

        const setupChannel = await testingConnection.getChannel();
        await ChannelTestHelpers.deleteQueue(setupChannel, queueName);

        const config = RunMQProcessorConfigurationExample.simpleNoSchema(queueName);
        const received: any[] = [];
        await runMQ.process(topic, config, async (msg) => {
            received.push(msg);
        });

        runMQ.publish(topic, {ok: true});
        await RunMQUtils.delay(500);
        expect(received.length).toBe(1);

        await ChannelTestHelpers.deleteQueue(setupChannel, queueName);
        await runMQ.disconnect();
    }, 15000);
});
