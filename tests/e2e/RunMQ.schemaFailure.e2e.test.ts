import {RunMQ} from '@src/core/RunMQ';
import {RabbitMQClientAdapter} from "@src/core/clients/RabbitMQClientAdapter";
import {Constants} from "@src/core/constants";
import {ChannelTestHelpers} from "@tests/helpers/ChannelTestHelpers";
import {ConsumerCreatorUtils} from "@src/core/consumer/ConsumerCreatorUtils";
import {RunMQUtils} from "@src/core/utils/RunMQUtils";
import {MockedRunMQLogger} from "@tests/mocks/MockedRunMQLogger";
import {RunMQConnectionConfigExample} from "@tests/Examples/RunMQConnectionConfigExample";
import {RunMQProcessorConfigurationExample, MessageSchemaExample} from "@tests/Examples/RunMQProcessorConfigurationExample";
import {RunMQMessageExample} from "@tests/Examples/RunMQMessageExample";
import {MessageTestUtils} from "@tests/helpers/MessageTestUtils";
import {RunMQMessage, RunMQMessageMeta} from "@src/core/message/RunMQMessage";

/**
 * Integration tests for issue #23: schema-validation `failureStrategy: 'dlq'`
 * must route invalid messages straight to the DLQ on first delivery, with no
 * retries. A malformed message will never become valid by retrying — that's
 * just dead time and broker churn.
 */
describe('RunMQ Schema Failure Strategy E2E', () => {
    const validConfig = RunMQConnectionConfigExample.valid();

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('routes schema-invalid message straight to DLQ on first delivery (no retries)', async () => {
        const configuration = RunMQProcessorConfigurationExample.random(
            'schema_dlq_strategy',
            1,
            5,    // 5 attempts — the test must prove these aren't used
            500,  // 500ms retry delay — gives plenty of time to observe retries if they happen
            MessageSchemaExample.simplePersonSchema(),
        );

        const testingConnection = new RabbitMQClientAdapter(validConfig);
        const channel = await testingConnection.getChannel();
        await ChannelTestHelpers.deleteQueue(channel, configuration.name);

        const runMQ = await RunMQ.start(validConfig, MockedRunMQLogger);
        let handlerCalls = 0;
        await runMQ.process('user.created', configuration, () => {
            handlerCalls++;
            return Promise.resolve();
        });

        // Publish a message that is structurally a RunMQMessage but fails the
        // person schema (age is a string, not an integer).
        const invalidPayload = JSON.stringify(new RunMQMessage(
            {name: 'Alice', age: 'not-a-number', email: 'a@b.com'} as any,
            new RunMQMessageMeta('msg-id', Date.now(), 'corr-id'),
        ));
        channel.publish(
            Constants.ROUTER_EXCHANGE_NAME,
            'user.created',
            Buffer.from(invalidPayload),
        );

        // Wait long enough that retries WOULD have fired (5 × 500ms = 2.5s).
        // If failureStrategy is honoured the message lands in DLQ within the
        // first ~200ms and stays there.
        await RunMQUtils.delay(800);

        // The user handler must NEVER have been invoked.
        expect(handlerCalls).toBe(0);
        // DLQ holds exactly the one message.
        await ChannelTestHelpers.assertQueueMessageCount(channel, ConsumerCreatorUtils.getDLQTopicName(configuration.name), 1);
        // Main queue is empty.
        await ChannelTestHelpers.assertQueueMessageCount(channel, configuration.name, 0);
        // Retry-delay queue is empty — no retry attempts were scheduled.
        await ChannelTestHelpers.assertQueueMessageCount(channel, ConsumerCreatorUtils.getRetryDelayTopicName(configuration.name), 0);

        await runMQ.disconnect();
        await testingConnection.disconnect();
    });

    it('still retries handler errors normally (the fix only short-circuits schema errors)', async () => {
        const configuration = RunMQProcessorConfigurationExample.random(
            'schema_handler_retries',
            1,
            3,   // 3 attempts
            100,
            MessageSchemaExample.simplePersonSchema(),  // Schema configured, but message will be VALID
        );

        const testingConnection = new RabbitMQClientAdapter(validConfig);
        const channel = await testingConnection.getChannel();
        await ChannelTestHelpers.deleteQueue(channel, configuration.name);

        const runMQ = await RunMQ.start(validConfig, MockedRunMQLogger);
        let handlerCalls = 0;
        await runMQ.process('user.created', configuration, () => {
            handlerCalls++;
            throw new Error('handler intentionally fails');
        });

        // Publish a SCHEMA-VALID message — the handler will be the thing failing.
        channel.publish(
            Constants.ROUTER_EXCHANGE_NAME,
            'user.created',
            MessageTestUtils.buffer(RunMQMessageExample.person()),
        );

        await RunMQUtils.delay(800);

        // Handler invoked 3 times (full retry budget), then DLQ'd.
        expect(handlerCalls).toBe(3);
        await ChannelTestHelpers.assertQueueMessageCount(channel, ConsumerCreatorUtils.getDLQTopicName(configuration.name), 1);
        await ChannelTestHelpers.assertQueueMessageCount(channel, configuration.name, 0);
        await ChannelTestHelpers.assertQueueMessageCount(channel, ConsumerCreatorUtils.getRetryDelayTopicName(configuration.name), 0);

        await runMQ.disconnect();
        await testingConnection.disconnect();
    });
});
