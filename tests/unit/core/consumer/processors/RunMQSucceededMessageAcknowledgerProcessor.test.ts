import {RunMQConsumer} from "@src/types";
import {RabbitMQMessage} from "@src/core/message/RabbitMQMessage";
import {
    RunMQSucceededMessageAcknowledgerProcessor
} from "@src/core/consumer/processors/RunMQSucceededMessageAcknowledgerProcessor";

describe('RunMQSucceededMessageAcknowledgerProcessor', () => {
    const consumer: jest.Mocked<RunMQConsumer> = {
        consume: jest.fn().mockReturnValueOnce(true).mockReturnValueOnce(false),
    }

    const message = {
        channel: {
            ack: jest.fn()
        }
    } as unknown as jest.Mocked<RabbitMQMessage>;

    beforeEach(() => {
        jest.clearAllMocks();
    })

    it("should ack message when the processor succeeds", () => {
        const processor = new RunMQSucceededMessageAcknowledgerProcessor(consumer)
        const result = processor.consume(message)
        expect(result).toBe(true)
        expect(message.channel.ack).toHaveBeenCalledWith(message.message)
    });


    it("should return false and not ack message when result is false", () => {
        const processor = new RunMQSucceededMessageAcknowledgerProcessor(consumer)
        const result = processor.consume(message)
        expect(result).toBe(false)
        expect(message.channel.ack).not.toHaveBeenCalled()
    })


    it("should rethrow when consumer throws", () => {
        const throwingConsumer: jest.Mocked<RunMQConsumer> = {
            consume: jest.fn().mockImplementationOnce(() => {
                throw new Error("Test error");
            }),
        }
        const processor = new RunMQSucceededMessageAcknowledgerProcessor(throwingConsumer)
        try {
            processor.consume(message);
        } catch (error) {
            expect(error).toBeInstanceOf(Error);
        }
    })

})