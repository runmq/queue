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
import {MockedAMQPChannelWithAcknowledgeFailure} from "@tests/mocks/MockedAMQPChannel";

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
            message
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
            message
        )
    });
});