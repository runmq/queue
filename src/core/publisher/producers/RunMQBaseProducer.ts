import {RunMQPublisher} from "@src/types";
import {RunMQMessage, RunMQMessageMeta} from "@src/core/message/RunMQMessage";
import {Channel} from "amqplib";
import {DefaultSerializer} from "@src/core/serializers/DefaultSerializer";
import {Constants} from "@src/core/constants";

export class RunMQBaseProducer implements RunMQPublisher {
    constructor(private readonly channel: Channel, private serializer: DefaultSerializer) {
    }

    publish(topic: string, message: any): void {
        const runMQMessage = new RunMQMessage(message, new RunMQMessageMeta(
            "TODO_USE_ID_GENERATOR_HERE",
            Date.now(),
        ));
        const serialized = this.serializer.serialize(runMQMessage);
        this.channel.publish(Constants.ROUTER_EXCHANGE_NAME, topic, Buffer.from(serialized));
    }
}