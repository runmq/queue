import type {Channel, AsyncMessage} from "rabbitmq-client";
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
 * Wrapper around rabbitmq-client Channel that implements the AMQPChannel interface.
 * Provides a library-agnostic abstraction over channel operations.
 */
export class RabbitMQClientChannel implements AMQPChannel {
    constructor(private readonly channel: Channel) {}

    async assertQueue(queue: string, options?: AMQPQueueOptions): Promise<AMQPQueueInfo> {
        const args: Record<string, any> = {};
        if (options?.deadLetterExchange) args['x-dead-letter-exchange'] = options.deadLetterExchange;
        if (options?.deadLetterRoutingKey) args['x-dead-letter-routing-key'] = options.deadLetterRoutingKey;
        if (options?.messageTtl) args['x-message-ttl'] = options.messageTtl;
        if (options?.arguments) Object.assign(args, options.arguments);

        const result = await this.channel.queueDeclare({
            queue,
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
        const result = await this.channel.queueDeclare({
            queue,
            passive: true,
        });
        return {
            queue: result.queue,
            messageCount: result.messageCount,
            consumerCount: result.consumerCount,
        };
    }

    async deleteQueue(queue: string, options?: { ifUnused?: boolean; ifEmpty?: boolean }): Promise<{ messageCount: number }> {
        const result = await this.channel.queueDelete({
            queue,
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

        await this.channel.exchangeDeclare({
            exchange,
            type,
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
        await this.channel.exchangeDeclare({
            exchange,
            passive: true,
        });
        return {
            exchange,
        };
    }

    async deleteExchange(exchange: string, options?: { ifUnused?: boolean }): Promise<void> {
        await this.channel.exchangeDelete({
            exchange,
            ifUnused: options?.ifUnused,
        });
    }

    async bindQueue(queue: string, source: string, pattern: string, args?: Record<string, any>): Promise<void> {
        await this.channel.queueBind({
            queue,
            exchange: source,
            routingKey: pattern,
            arguments: args,
        });
    }

    publish(exchange: string, routingKey: string, content: Buffer, options?: AMQPPublishOptions): boolean {
        this.channel.basicPublish({
            exchange,
            routingKey,
            correlationId: options?.correlationId,
            messageId: options?.messageId,
            headers: options?.headers,
            durable: options?.persistent,
            expiration: options?.expiration?.toString(),
            contentType: options?.contentType,
            contentEncoding: options?.contentEncoding,
            priority: options?.priority,
            replyTo: options?.replyTo,
            timestamp: options?.timestamp,
            type: options?.type,
            userId: options?.userId,
            appId: options?.appId,
        }, content);
        return true;
    }

    async consume(
        queue: string,
        onMessage: (msg: ConsumeMessage | null) => void,
        options?: AMQPConsumeOptions
    ): Promise<AMQPConsumeInfo> {
        const result = await this.channel.basicConsume({
            queue,
            consumerTag: options?.consumerTag,
            noLocal: options?.noLocal,
            noAck: options?.noAck,
            exclusive: options?.exclusive,
            arguments: options?.arguments,
        }, (msg: AsyncMessage) => {
            // Convert rabbitmq-client message format to our ConsumeMessage format
            const body = msg.body;
            const content = Buffer.isBuffer(body) ? body :
                           typeof body === 'string' ? Buffer.from(body) :
                           Buffer.from(JSON.stringify(body));

            const consumeMessage: ConsumeMessage = {
                content,
                fields: {
                    consumerTag: msg.consumerTag,
                    deliveryTag: msg.deliveryTag,
                    redelivered: msg.redelivered,
                    exchange: msg.exchange,
                    routingKey: msg.routingKey,
                },
                properties: {
                    contentType: msg.contentType,
                    contentEncoding: msg.contentEncoding,
                    headers: msg.headers || {},
                    deliveryMode: msg.durable ? 2 : 1,
                    priority: msg.priority,
                    correlationId: msg.correlationId,
                    replyTo: msg.replyTo,
                    expiration: msg.expiration,
                    messageId: msg.messageId,
                    timestamp: msg.timestamp,
                    type: msg.type,
                    userId: msg.userId,
                    appId: msg.appId,
                },
            };
            onMessage(consumeMessage);
        });
        return {
            consumerTag: result.consumerTag,
        };
    }

    ack(message: ConsumeMessage, allUpTo?: boolean): void {
        this.channel.basicAck({
            deliveryTag: message.fields.deliveryTag,
            multiple: allUpTo,
        });
    }

    nack(message: ConsumeMessage, allUpTo?: boolean, requeue?: boolean): void {
        this.channel.basicNack({
            deliveryTag: message.fields.deliveryTag,
            multiple: allUpTo,
            requeue,
        });
    }

    async prefetch(count: number, global?: boolean): Promise<void> {
        await this.channel.basicQos({
            prefetchCount: count,
            global,
        });
    }

    async close(): Promise<void> {
        await this.channel.close();
    }
}

