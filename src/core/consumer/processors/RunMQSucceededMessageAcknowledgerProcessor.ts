import {RunMQConsumer} from "@src/types";
import {RabbitMQMessage} from "@src/core/message/RabbitMQMessage";

export class RunMQSucceededMessageAcknowledgerProcessor implements RunMQConsumer {
    constructor(private consumer: RunMQConsumer) {
    }

    public consume(message: RabbitMQMessage) {
        try {
            const result = this.consumer.consume(message);
            if (result) {
                message.channel.ack(message.message)
            }
            return result;
        } catch (e) {
            throw Error(e as never)
        }
    }
}