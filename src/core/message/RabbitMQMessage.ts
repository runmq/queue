import {RabbitMQMessageProperties} from "@src/core/message/RabbitMQMessageProperties";
import {AMQPMessage} from "@src/core/message/AmqpMessage";
import {AMQPChannel} from "@src/types";

export class RabbitMQMessage {
    constructor(
        readonly message: any,
        readonly id: string,
        readonly correlationId: string,
        readonly channel: AMQPChannel,
        readonly amqpMessage: AMQPMessage = null,
        readonly headers: Record<string, any> = {}) {
    }

    /**
     * Acknowledges the message. Returns true on success, false if the
     * underlying channel rejected the call (e.g. closed mid-flight).
     * Plumbing errors are intentionally swallowed: the broker will redeliver
     * unacked messages on channel close, so escalating here only crashes
     * the consumer for no recovery benefit.
     */
    ack(): boolean {
        if (!this.amqpMessage) return false;
        try {
            this.channel.ack(this.amqpMessage);
            return true;
        } catch {
            return false;
        }
    }

    /**
     * Negatively acknowledges the message. Returns true on success, false if
     * the underlying channel rejected the call. See `ack()` for rationale.
     * @param requeue - Whether to requeue the message (default: false)
     */
    nack(requeue: boolean = false): boolean {
        if (!this.amqpMessage) return false;
        try {
            this.channel.nack(this.amqpMessage, false, requeue);
            return true;
        } catch {
            return false;
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