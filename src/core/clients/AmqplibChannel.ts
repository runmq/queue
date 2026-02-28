import type {Channel, ConsumeMessage as AmqplibConsumeMessage} from "amqplib";
import {
    AMQPChannel,
    AMQPConsumeInfo,
    AMQPConsumeOptions,
    AMQPExchangeInfo,
    AMQPExchangeOptions,
    AMQPPublishOptions,
    AMQPQueueInfo,
    AMQPQueueOptions,
    ConsumeMessage
} from "@src/types";

/**
 * Wrapper around amqplib Channel that implements the AMQPChannel interface.
 * Provides a library-agnostic abstraction over channel operations.
 */
export class AmqplibChannel implements AMQPChannel {
    constructor(private readonly channel: Channel) {}

    async assertQueue(queue: string, options?: AMQPQueueOptions): Promise<AMQPQueueInfo> {
        const args: Record<string, any> = {};
        if (options?.deadLetterExchange) args['x-dead-letter-exchange'] = options.deadLetterExchange;
        if (options?.deadLetterRoutingKey) args['x-dead-letter-routing-key'] = options.deadLetterRoutingKey;
        if (options?.messageTtl) args['x-message-ttl'] = options.messageTtl;
        if (options?.arguments) Object.assign(args, options.arguments);

        const result = await this.channel.assertQueue(queue, {
            durable: options?.durable,
            exclusive: options?.exclusive,
            autoDelete: options?.autoDelete,
            arguments: Object.keys(args).length > 0 ? args : undefined,
        });
        return {
            queue: result.queue,
            messageCount: result.messageCount,
            consumerCount: result.consumerCount,
        };
    }

    async checkQueue(queue: string): Promise<AMQPQueueInfo> {
        const result = await this.channel.checkQueue(queue);
        return {
            queue: result.queue,
            messageCount: result.messageCount,
            consumerCount: result.consumerCount,
        };
    }

    async deleteQueue(queue: string, options?: { ifUnused?: boolean; ifEmpty?: boolean }): Promise<{ messageCount: number }> {
        const result = await this.channel.deleteQueue(queue, {
            ifUnused: options?.ifUnused,
            ifEmpty: options?.ifEmpty,
        });
        return {
            messageCount: result.messageCount,
        };
    }

    async assertExchange(exchange: string, type: string, options?: AMQPExchangeOptions): Promise<AMQPExchangeInfo> {
        const args: Record<string, any> = {};
        if (options?.alternateExchange) args['alternate-exchange'] = options.alternateExchange;
        if (options?.arguments) Object.assign(args, options.arguments);

        await this.channel.assertExchange(exchange, type, {
            durable: options?.durable,
            internal: options?.internal,
            autoDelete: options?.autoDelete,
            arguments: Object.keys(args).length > 0 ? args : undefined,
        });
        return {
            exchange,
        };
    }

    async checkExchange(exchange: string): Promise<AMQPExchangeInfo> {
        await this.channel.checkExchange(exchange);
        return {
            exchange,
        };
    }

    async deleteExchange(exchange: string, options?: { ifUnused?: boolean }): Promise<void> {
        await this.channel.deleteExchange(exchange, {
            ifUnused: options?.ifUnused,
        });
    }

    async bindQueue(queue: string, source: string, pattern: string, args?: Record<string, any>): Promise<void> {
        await this.channel.bindQueue(queue, source, pattern, args);
    }

    publish(exchange: string, routingKey: string, content: Buffer, options?: AMQPPublishOptions): boolean {
        return this.channel.publish(exchange, routingKey, content, {
            correlationId: options?.correlationId,
            messageId: options?.messageId,
            headers: options?.headers,
            persistent: options?.persistent,
            expiration: options?.expiration?.toString(),
            contentType: options?.contentType,
            contentEncoding: options?.contentEncoding,
            priority: options?.priority,
            replyTo: options?.replyTo,
            timestamp: options?.timestamp,
            type: options?.type,
            userId: options?.userId,
            appId: options?.appId,
        });
    }

    async consume(
        queue: string,
        onMessage: (msg: ConsumeMessage | null) => void,
        options?: AMQPConsumeOptions
    ): Promise<AMQPConsumeInfo> {
        const result = await this.channel.consume(queue, (msg: AmqplibConsumeMessage | null) => {
            if (msg === null) {
                onMessage(null);
                return;
            }

            const consumeMessage: ConsumeMessage = {
                content: msg.content,
                fields: {
                    consumerTag: msg.fields.consumerTag,
                    deliveryTag: msg.fields.deliveryTag,
                    redelivered: msg.fields.redelivered,
                    exchange: msg.fields.exchange,
                    routingKey: msg.fields.routingKey,
                },
                properties: {
                    contentType: msg.properties.contentType || undefined,
                    contentEncoding: msg.properties.contentEncoding || undefined,
                    headers: msg.properties.headers || {},
                    deliveryMode: msg.properties.deliveryMode,
                    priority: msg.properties.priority,
                    correlationId: msg.properties.correlationId || undefined,
                    replyTo: msg.properties.replyTo || undefined,
                    expiration: msg.properties.expiration || undefined,
                    messageId: msg.properties.messageId || undefined,
                    timestamp: msg.properties.timestamp,
                    type: msg.properties.type || undefined,
                    userId: msg.properties.userId || undefined,
                    appId: msg.properties.appId || undefined,
                },
            };
            onMessage(consumeMessage);
        }, {
            consumerTag: options?.consumerTag,
            noLocal: options?.noLocal,
            noAck: options?.noAck,
            exclusive: options?.exclusive,
            priority: options?.priority,
            arguments: options?.arguments,
        });
        return {
            consumerTag: result.consumerTag,
        };
    }

    ack(message: ConsumeMessage, allUpTo?: boolean): void {
        this.channel.ack(
            { fields: message.fields, content: message.content, properties: message.properties } as AmqplibConsumeMessage,
            allUpTo,
        );
    }

    nack(message: ConsumeMessage, allUpTo?: boolean, requeue?: boolean): void {
        this.channel.nack(
            { fields: message.fields, content: message.content, properties: message.properties } as AmqplibConsumeMessage,
            allUpTo,
            requeue,
        );
    }

    async prefetch(count: number, global?: boolean): Promise<void> {
        await this.channel.prefetch(count, global);
    }

    async close(): Promise<void> {
        await this.channel.close();
    }
}
