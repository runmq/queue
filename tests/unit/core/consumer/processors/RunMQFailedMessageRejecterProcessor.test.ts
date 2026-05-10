import {RunMQFailedMessageRejecterProcessor} from "@src/core/consumer/processors/RunMQFailedMessageRejecterProcessor";
import {MockedThrowableRabbitMQConsumer} from "@tests/mocks/MockedRunMQConsumer";
import {RabbitMQMessage} from "@src/core/message/RabbitMQMessage";
import {MockedRunMQLogger} from "@tests/mocks/MockedRunMQLogger";

describe('RunMQFailedMessageRejecterProcessor', () => {
    const consumer = new MockedThrowableRabbitMQConsumer()

    const mockMessage = {
        correlationId: 'corr-id',
        ack: jest.fn().mockReturnValue(true),
        nack: jest.fn().mockReturnValue(true),
    } as unknown as jest.Mocked<RabbitMQMessage>;

    beforeEach(() => {
        jest.clearAllMocks();
        (mockMessage.nack as jest.Mock).mockReturnValue(true);
    });

    it("should nack message with requeue false when consumer throws", async () => {
        const processor = new RunMQFailedMessageRejecterProcessor(consumer)
        const result = await processor.consume(mockMessage)
        expect(result).toBe(false)
        expect(mockMessage.nack).toHaveBeenCalledWith(false)
    });

    it("should warn and not throw when nack fails (channel closed)", async () => {
        (mockMessage.nack as jest.Mock).mockReturnValue(false);
        const processor = new RunMQFailedMessageRejecterProcessor(consumer, MockedRunMQLogger)

        await expect(processor.consume(mockMessage)).resolves.toBe(false);
        expect(mockMessage.nack).toHaveBeenCalledWith(false);
        expect(MockedRunMQLogger.warn).toHaveBeenCalledWith(
            expect.stringContaining('Failed to nack message'),
            expect.objectContaining({correlationId: 'corr-id'}),
        );
    });
})
