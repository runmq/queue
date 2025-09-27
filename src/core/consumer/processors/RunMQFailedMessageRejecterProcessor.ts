import {RunMQConsumer} from "@src/types";
import {RabbitMQMessage} from "@src/core/message/RabbitMQMessage";

export class RunMQFailedMessageRejecterProcessor implements RunMQConsumer {
    constructor(private consumer: RunMQConsumer) {
    }

    public consume(message: RabbitMQMessage): boolean {
        try {
            return this.consumer.consume(message);
        } catch {
            message.channel.nack(message.message, false, false);
            return false;
        }
    }
}