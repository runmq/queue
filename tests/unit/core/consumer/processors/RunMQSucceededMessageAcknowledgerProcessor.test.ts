import {RabbitMQMessage} from "@src/core/message/RabbitMQMessage";
import {
    RunMQSucceededMessageAcknowledgerProcessor
} from "@src/core/consumer/processors/RunMQSucceededMessageAcknowledgerProcessor";
import {
    MockedFailedRabbitMQConsumer,
    MockedSuccessfulRabbitMQConsumer,
    MockedThrowableRabbitMQConsumer
} from "@tests/mocks/MockedRunMQConsumer";

describe('RunMQSucceededMessageAcknowledgerProcessor', () => {
    const message = {
        ack: jest.fn(),
        nack: jest.fn()
    } as unknown as jest.Mocked<RabbitMQMessage>;

    beforeEach(() => {
        jest.clearAllMocks();
    })

    it("should ack message when the processor succeeds", async () => {
        const successfulConsumer = new MockedSuccessfulRabbitMQConsumer()
        const processor = new RunMQSucceededMessageAcknowledgerProcessor(successfulConsumer)
        const result = await processor.consume(message)
        expect(result).toBe(true)
        expect(message.ack).toHaveBeenCalled()
    });

    it("should return false and not ack message when result is false", async () => {
        const failedConsumer = new MockedFailedRabbitMQConsumer()
        const processor = new RunMQSucceededMessageAcknowledgerProcessor(failedConsumer)
        const result = await processor.consume(message)
        expect(result).toBe(false)
        expect(message.ack).not.toHaveBeenCalled()
    })

    it("should rethrow when consumer throws", async () => {
        const throwableConsumer = new MockedThrowableRabbitMQConsumer()
        const processor = new RunMQSucceededMessageAcknowledgerProcessor(throwableConsumer)

        await expect(processor.consume(message)).rejects.toThrow(Error);
    })
})