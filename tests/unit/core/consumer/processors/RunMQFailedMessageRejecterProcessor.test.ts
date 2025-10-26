import {RunMQFailedMessageRejecterProcessor} from "@src/core/consumer/processors/RunMQFailedMessageRejecterProcessor";
import {MockedRabbitMQMessage} from "@tests/mocks/MockedRabbitMQMessage";
import {MockedThrowableRabbitMQConsumer} from "@tests/mocks/MockedRunMQConsumer";

describe('RunMQFailedMessageRejecterProcessor', () => {
    const consumer = new MockedThrowableRabbitMQConsumer()
    const rabbitMQMessage = MockedRabbitMQMessage

    it("should nack message with allUpTO false and requeue false when consumer throws", async () => {
        const processor = new RunMQFailedMessageRejecterProcessor(consumer)
        const result = await processor.consume(rabbitMQMessage)
        expect(result).toBe(false)
        expect(rabbitMQMessage.channel.nack).toHaveBeenCalledWith(rabbitMQMessage.amqpMessage, false, false)
    });
})