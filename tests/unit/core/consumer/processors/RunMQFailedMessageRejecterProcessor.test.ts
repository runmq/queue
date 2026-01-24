import {RunMQFailedMessageRejecterProcessor} from "@src/core/consumer/processors/RunMQFailedMessageRejecterProcessor";
import {MockedThrowableRabbitMQConsumer} from "@tests/mocks/MockedRunMQConsumer";
import {RabbitMQMessage} from "@src/core/message/RabbitMQMessage";

describe('RunMQFailedMessageRejecterProcessor', () => {
    const consumer = new MockedThrowableRabbitMQConsumer()

    const mockMessage = {
        ack: jest.fn(),
        nack: jest.fn()
    } as unknown as jest.Mocked<RabbitMQMessage>;

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it("should nack message with requeue false when consumer throws", async () => {
        const processor = new RunMQFailedMessageRejecterProcessor(consumer)
        const result = await processor.consume(mockMessage)
        expect(result).toBe(false)
        expect(mockMessage.nack).toHaveBeenCalledWith(false)
    });
})