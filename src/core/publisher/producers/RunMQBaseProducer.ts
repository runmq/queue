import {RunMQPublisher} from "@src/types";
import {DefaultSerializer} from "@src/core/serializers/DefaultSerializer";
import {Constants} from "@src/core/constants";
import {RabbitMQMessage} from "@src/core/message/RabbitMQMessage";
import {RunMQMessage, RunMQMessageMeta} from "@src/core/message/RunMQMessage";

export class RunMQBaseProducer implements RunMQPublisher {
    constructor(private serializer: DefaultSerializer, private exchange = Constants.ROUTER_EXCHANGE_NAME) {
    }

    publish(topic: string, message: RabbitMQMessage): void {
        const runMQMessage = new RunMQMessage(
            message.message,
            new RunMQMessageMeta(
                message.id,
                Date.now(),
                message.correlationId,
            ));
        const serialized = this.serializer.serialize(runMQMessage);
        message.channel.publish(this.exchange, topic, Buffer.from(serialized), {
            correlationId: message.correlationId,
            messageId: message.id,
            headers: message.headers,
        });
    }
}