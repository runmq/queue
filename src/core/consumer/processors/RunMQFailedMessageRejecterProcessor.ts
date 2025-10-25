import {RunMQConsumer} from "@src/types";
import {RabbitMQMessage} from "@src/core/message/RabbitMQMessage";

export class RunMQFailedMessageRejecterProcessor implements RunMQConsumer {
    constructor(private consumer: RunMQConsumer) {
    }

    public async consume(message: RabbitMQMessage): Promise<boolean> {
        try {
            return await this.consumer.consume(message);
        } catch {
            message.channel.nack(message.amqpMessage!, false, false);
            return false;
        }
    }
}