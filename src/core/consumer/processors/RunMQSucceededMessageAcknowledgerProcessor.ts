import {RunMQConsumer} from "@src/types";
import {RabbitMQMessage} from "@src/core/message/RabbitMQMessage";

export class RunMQSucceededMessageAcknowledgerProcessor implements RunMQConsumer {
    constructor(private consumer: RunMQConsumer) {
    }

    public async consume(message: RabbitMQMessage) {
        const result = await this.consumer.consume(message);
        if (result) {
            message.channel.ack(message.amqpMessage!)
        }
        return result;
    }
}