import {RunMQRetriesCheckerProcessor} from "@src/core/consumer/processors/RunMQRetriesCheckerProcessor";
import {ConsumerCreatorUtils} from "@src/core/consumer/ConsumerCreatorUtils";
import {MockedThrowableRabbitMQConsumer} from "@tests/mocks/MockedRunMQConsumer";
import {RunMQProcessorConfigurationExample} from "@tests/Examples/RunMQProcessorConfigurationExample";
import {MockedRunMQLogger} from "@tests/mocks/MockedRunMQLogger";
import {
    mockedRabbitMQMessageWithChannelAndDeathCount,
    mockedRabbitMQMessageWithDeathCount
} from "@tests/mocks/MockedRabbitMQMessage";
import {MockedRabbitMQPublisher} from "@tests/mocks/MockedRunMQPublisher";
import {MockedAMQPChannelWithAcknowledgeFailure, MockedAMQPChannel} from "@tests/mocks/MockedAMQPChannel";
import {RabbitMQMessage} from "@src/core/message/RabbitMQMessage";
import {RunMQMessage, RunMQMessageMeta} from "@src/core/message/RunMQMessage";
import {MockedAmqpMessage} from "@tests/mocks/MockedAmqpMessage";

describe('RunMQRetriesCheckerProcessor', () => {
    const consumer = new MockedThrowableRabbitMQConsumer()
    const processorConfig = RunMQProcessorConfigurationExample.withAttempts(3)

    it("should throw error if message hasn't reached max attempts yet", async () => {
        const message = mockedRabbitMQMessageWithDeathCount(1)
        const runMQPublisher = new MockedRabbitMQPublisher()

        const processor = new RunMQRetriesCheckerProcessor(consumer, processorConfig, runMQPublisher, MockedRunMQLogger)
        await expect(processor.consume(message)).rejects.toThrow(Error);
    })

    it('should log and move to dead-letter queue when max attempts reached and acknowledge message', async () => {
        const message = mockedRabbitMQMessageWithDeathCount(2)
        const runMQPublisher = new MockedRabbitMQPublisher()

        const processor = new RunMQRetriesCheckerProcessor(consumer, processorConfig, runMQPublisher, MockedRunMQLogger)
        await processor.consume(message)

        expect(MockedRunMQLogger.error).toHaveBeenCalledWith(`Message reached maximum attempts. Moving to dead-letter queue.`, {
            message: message.message,
            attempts: 3,
            max: 3,
        });
        expect(runMQPublisher.publish).toHaveBeenCalledWith(
            ConsumerCreatorUtils.getDLQTopicName(processorConfig.name),
            expect.objectContaining({
                message: message.message,
                id: message.id,
                correlationId: message.correlationId,
                headers: message.headers,
            })
        )
        expect(message.channel.ack).toHaveBeenCalledWith(message.amqpMessage);
    })
})

describe('RunMQRetriesCheckerProcessor - acknowledgeMessage', () => {
    const consumer = new MockedThrowableRabbitMQConsumer()
    const processorConfig = RunMQProcessorConfigurationExample.withAttempts(3)

    it("should throw error if acknowledge message failed", async () => {
        const message = mockedRabbitMQMessageWithChannelAndDeathCount(
            new MockedAMQPChannelWithAcknowledgeFailure(),
            2
        )
        const runMQPublisher = new MockedRabbitMQPublisher()
        const processor = new RunMQRetriesCheckerProcessor(consumer, processorConfig, runMQPublisher, MockedRunMQLogger)

        await expect(processor.consume(message)).rejects.toMatchObject({
            message: "A message acknowledge failed after publishing to final dead letter",
        });

        expect(MockedRunMQLogger.error).toHaveBeenCalledWith(`Message reached maximum attempts. Moving to dead-letter queue.`, {
            message: message.message,
            attempts: 3,
            max: 3,
        });
        expect(runMQPublisher.publish).toHaveBeenCalledWith(
            ConsumerCreatorUtils.getDLQTopicName(processorConfig.name),
            expect.objectContaining({
                message: message.message,
                id: message.id,
                correlationId: message.correlationId,
                headers: message.headers,
            })
        )
    });
});

describe('RunMQRetriesCheckerProcessor - DLQ message double encoding', () => {
    const consumer = new MockedThrowableRabbitMQConsumer()
    const processorConfig = RunMQProcessorConfigurationExample.withAttempts(3)

    it('should extract the original payload when message content is a serialized RunMQMessage', async () => {
        const originalPayload = {userId: "123", email: "user@example.com", name: "John Doe"};
        const serializedContent = JSON.stringify(new RunMQMessage(
            originalPayload,
            new RunMQMessageMeta("msg-id", Date.now(), "corr-id")
        ));

        const channel = new MockedAMQPChannel();
        const message = new RabbitMQMessage(
            serializedContent,
            "msg-id",
            "corr-id",
            channel,
            MockedAmqpMessage,
            {"x-death": [{count: 2, reason: "rejected"}]}
        );

        const runMQPublisher = new MockedRabbitMQPublisher();
        const processor = new RunMQRetriesCheckerProcessor(consumer, processorConfig, runMQPublisher, MockedRunMQLogger);
        await processor.consume(message);

        const rabbitMQMessage = runMQPublisher.publish.mock.calls[0][1] as RabbitMQMessage;
        expect(rabbitMQMessage.message).toEqual(originalPayload);
        expect(rabbitMQMessage.id).toBe(message.id);
        expect(rabbitMQMessage.correlationId).toBe(message.correlationId);
    });

    it('should keep message as-is when content is not a serialized RunMQMessage', async () => {
        const plainContent = "plain text message";
        const channel = new MockedAMQPChannel();
        const message = new RabbitMQMessage(
            plainContent,
            "msg-id",
            "corr-id",
            channel,
            MockedAmqpMessage,
            {"x-death": [{count: 2, reason: "rejected"}]}
        );

        const runMQPublisher = new MockedRabbitMQPublisher();
        const processor = new RunMQRetriesCheckerProcessor(consumer, processorConfig, runMQPublisher, MockedRunMQLogger);
        await processor.consume(message);

        const publishedMessage = runMQPublisher.publish.mock.calls[0][1] as RabbitMQMessage;
        expect(publishedMessage.message).toBe(plainContent);
    });

    it('should keep message as-is when content is a non-RunMQMessage JSON string', async () => {
        const jsonContent = JSON.stringify({foo: "bar"});
        const channel = new MockedAMQPChannel();
        const message = new RabbitMQMessage(
            jsonContent,
            "msg-id",
            "corr-id",
            channel,
            MockedAmqpMessage,
            {"x-death": [{count: 2, reason: "rejected"}]}
        );

        const runMQPublisher = new MockedRabbitMQPublisher();
        const processor = new RunMQRetriesCheckerProcessor(consumer, processorConfig, runMQPublisher, MockedRunMQLogger);
        await processor.consume(message);

        const publishedMessage = runMQPublisher.publish.mock.calls[0][1] as RabbitMQMessage;
        expect(publishedMessage.message).toBe(jsonContent);
    });
});