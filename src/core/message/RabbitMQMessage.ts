import {RunMQUtils} from "@src/core/utils/RunMQUtils";
import {RabbitMQMessageProperties} from "@src/core/message/RabbitMQMessageProperties";
import {AMQPMessage} from "@src/core/message/AmqpMessage";
import {AMQPChannel} from "@src/types";

export class RabbitMQMessage {
    constructor(
        readonly message: any,
        readonly id: string = RunMQUtils.generateUUID(),
        readonly correlationId: string = RunMQUtils.generateUUID(),
        readonly channel: AMQPChannel,
        readonly amqpMessage: AMQPMessage = null,
        readonly headers: Record<string, any> = {}) {
    }

    /**
     * Acknowledges the message.
     */
    ack(): void {
        if (this.amqpMessage) {
            this.channel.ack(this.amqpMessage);
        }
    }

    /**
     * Negatively acknowledges the message.
     * @param requeue - Whether to requeue the message (default: false)
     */
    nack(requeue: boolean = false): void {
        if (this.amqpMessage) {
            this.channel.nack(this.amqpMessage, false, requeue);
        }
    }

    static from(
        messageData: Record<string, any>,
        channel: AMQPChannel,
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