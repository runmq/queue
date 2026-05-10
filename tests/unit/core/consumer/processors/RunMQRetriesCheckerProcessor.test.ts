import {RunMQRetriesCheckerProcessor} from "@src/core/consumer/processors/RunMQRetriesCheckerProcessor";
import {ConsumerCreatorUtils} from "@src/core/consumer/ConsumerCreatorUtils";
import {Constants} from "@src/core/constants";
import {MockedThrowableRabbitMQConsumer} from "@tests/mocks/MockedRunMQConsumer";
import {RunMQProcessorConfigurationExample} from "@tests/Examples/RunMQProcessorConfigurationExample";
import {MockedRunMQLogger} from "@tests/mocks/MockedRunMQLogger";
import {
    mockedRabbitMQMessageWithChannelAndDeathCount,
    mockedRabbitMQMessageWithDeathCount
} from "@tests/mocks/MockedRabbitMQMessage";
import {MockedAMQPChannelWithAcknowledgeFailure, MockedAMQPChannel} from "@tests/mocks/MockedAMQPChannel";
import {RabbitMQMessage} from "@src/core/message/RabbitMQMessage";
import {RunMQMessage, RunMQMessageMeta} from "@src/core/message/RunMQMessage";

describe('RunMQRetriesCheckerProcessor', () => {
    const consumer = new MockedThrowableRabbitMQConsumer()
    const processorConfig = RunMQProcessorConfigurationExample.withAttempts(3)

    it("should throw error if message hasn't reached max attempts yet", async () => {
        const message = mockedRabbitMQMessageWithDeathCount(1)

        const processor = new RunMQRetriesCheckerProcessor(consumer, processorConfig, MockedRunMQLogger)
        await expect(processor.consume(message)).rejects.toThrow(Error);
    })

    it('should log and move to dead-letter queue when max attempts reached and acknowledge message', async () => {
        const message = mockedRabbitMQMessageWithDeathCount(2)

        const processor = new RunMQRetriesCheckerProcessor(consumer, processorConfig, MockedRunMQLogger)
        await processor.consume(message)

        expect(MockedRunMQLogger.error).toHaveBeenCalledWith(`Message reached maximum attempts. Moving to dead-letter queue.`, {
            message: message.message,
            attempts: 3,
            max: 3,
        });
        expect(message.channel.publish).toHaveBeenCalledWith(
            Constants.DEAD_LETTER_ROUTER_EXCHANGE_NAME,
            ConsumerCreatorUtils.getDLQTopicName(processorConfig.name),
            message.amqpMessage!.content,
            {
                correlationId: message.correlationId,
                messageId: message.id,
                headers: message.headers,
                persistent: true,
            }
        );
        expect(message.channel.ack).toHaveBeenCalledWith(message.amqpMessage);
    })
})

describe('RunMQRetriesCheckerProcessor - acknowledgeMessage', () => {
    const consumer = new MockedThrowableRabbitMQConsumer()
    const processorConfig = RunMQProcessorConfigurationExample.withAttempts(3)

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it("should warn and not throw when ack fails after publishing to DLQ", async () => {
        const message = mockedRabbitMQMessageWithChannelAndDeathCount(
            new MockedAMQPChannelWithAcknowledgeFailure(),
            2
        )
        const processor = new RunMQRetriesCheckerProcessor(consumer, processorConfig, MockedRunMQLogger)

        // Must NOT reject — a channel-closed ack failure should not propagate.
        // The broker will redeliver unacked messages on channel close.
        await expect(processor.consume(message)).resolves.toBe(false);

        expect(MockedRunMQLogger.error).toHaveBeenCalledWith(`Message reached maximum attempts. Moving to dead-letter queue.`, {
            message: message.message,
            attempts: 3,
            max: 3,
        });
        expect(message.channel.publish).toHaveBeenCalledWith(
            Constants.DEAD_LETTER_ROUTER_EXCHANGE_NAME,
            ConsumerCreatorUtils.getDLQTopicName(processorConfig.name),
            message.amqpMessage!.content,
            expect.objectContaining({
                correlationId: message.correlationId,
                messageId: message.id,
                headers: message.headers,
                persistent: true,
            })
        )
        expect(MockedRunMQLogger.warn).toHaveBeenCalledWith(
            expect.stringContaining('Failed to ack message after publishing to final dead letter'),
            expect.objectContaining({correlationId: message.correlationId}),
        );
    });
});

describe('RunMQRetriesCheckerProcessor - DLQ envelope preservation', () => {
    const consumer = new MockedThrowableRabbitMQConsumer()
    const processorConfig = RunMQProcessorConfigurationExample.withAttempts(3)

    it('should publish the original buffer verbatim, preserving the envelope including publishedAt', async () => {
        const originalPayload = {userId: "123", email: "user@example.com", name: "John Doe"};
        const originalPublishedAt = 1700000000000;
        const originalEnvelope = new RunMQMessage(
            originalPayload,
            new RunMQMessageMeta("msg-id", originalPublishedAt, "corr-id")
        );
        const originalBuffer = Buffer.from(JSON.stringify(originalEnvelope));

        const channel = new MockedAMQPChannel();
        const amqpMessage = {
            content: originalBuffer,
            fields: {
                consumerTag: 'test-consumer-tag',
                deliveryTag: 1,
                redelivered: false,
                exchange: 'test-exchange',
                routingKey: 'test-routing-key',
            },
            properties: {},
        } as any;
        const message = new RabbitMQMessage(
            originalBuffer.toString(),
            "msg-id",
            "corr-id",
            channel,
            amqpMessage,
            {"x-death": [{count: 2, reason: "rejected"}]}
        );

        const processor = new RunMQRetriesCheckerProcessor(consumer, processorConfig, MockedRunMQLogger);
        await processor.consume(message);

        expect(channel.publish).toHaveBeenCalledTimes(1);
        const publishedBuffer = channel.publish.mock.calls[0][2];
        expect(publishedBuffer).toBe(originalBuffer);

        const decoded = JSON.parse(publishedBuffer.toString());
        expect(decoded.message).toEqual(originalPayload);
        expect(decoded.meta.publishedAt).toBe(originalPublishedAt);
        expect(decoded.meta.id).toBe("msg-id");
        expect(decoded.meta.correlationId).toBe("corr-id");
    });

    it('should publish the original buffer even when content is not a valid envelope', async () => {
        const plainContent = "plain text message";
        const plainBuffer = Buffer.from(plainContent);
        const channel = new MockedAMQPChannel();
        const amqpMessage = {
            content: plainBuffer,
            fields: {
                consumerTag: 'test-consumer-tag',
                deliveryTag: 1,
                redelivered: false,
                exchange: 'test-exchange',
                routingKey: 'test-routing-key',
            },
            properties: {},
        } as any;
        const message = new RabbitMQMessage(
            plainContent,
            "msg-id",
            "corr-id",
            channel,
            amqpMessage,
            {"x-death": [{count: 2, reason: "rejected"}]}
        );

        const processor = new RunMQRetriesCheckerProcessor(consumer, processorConfig, MockedRunMQLogger);
        await processor.consume(message);

        expect(channel.publish).toHaveBeenCalledTimes(1);
        expect(channel.publish.mock.calls[0][2]).toBe(plainBuffer);
    });
});
