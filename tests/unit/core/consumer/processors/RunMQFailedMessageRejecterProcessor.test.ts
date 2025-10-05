import {RunMQConsumer} from "@src/types";
import {RabbitMQMessage} from "@src/core/message/RabbitMQMessage";
import {RunMQFailedMessageRejecterProcessor} from "@src/core/consumer/processors/RunMQFailedMessageRejecterProcessor";

describe('RunMQFailedMessageRejecterProcessor', () => {
    const consumer: jest.Mocked<RunMQConsumer> = {
        consume: jest.fn().mockImplementationOnce(() => {
            throw new Error("Test error");
        }),
    }
    const message = {
        channel: {
            nack: jest.fn()
        }
    } as unknown as jest.Mocked<RabbitMQMessage>;

    it("should nack message with allUpTO false and requeue false when consumer throws", async () => {
        const processor = new RunMQFailedMessageRejecterProcessor(consumer)
        const result = await processor.consume(message)
        expect(result).toBe(false)
        expect(message.channel.nack).toHaveBeenCalledWith(message.message, false, false)
    });
})