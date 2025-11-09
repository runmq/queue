import {Channel} from "amqplib";
import {RunMQUtils} from "@src/core/utils/RunMQUtils";
import {RabbitMQMessageProperties} from "@src/core/message/RabbitMQMessageProperties";
import {AMQPMessage} from "@src/core/message/AmqpMessage";

export class RabbitMQMessage {
    constructor(
        readonly message: any,
        readonly id: string = RunMQUtils.generateUUID(),
        readonly correlationId: string = RunMQUtils.generateUUID(),
        readonly channel: Channel,
        readonly amqpMessage: AMQPMessage = null,
        readonly headers: Record<string, any> = {}) {
    }

    static from(
        messageData: Record<string, any>,
        channel: Channel,
        props: RabbitMQMessageProperties,
        amqpMessage: AMQPMessage = null
    ): RabbitMQMessage {
        return new RabbitMQMessage(
            messageData,
            props.id,
            props.correlationId,
            channel,
            amqpMessage,
            {}
        );
    }
}