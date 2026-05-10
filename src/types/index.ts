import {RabbitMQMessage} from "@src/core/message/RabbitMQMessage";

/**
 * Represents a message consumed from a queue.
 * Library-agnostic format compatible with both amqplib and rabbitmq-client.
 */
export interface ConsumeMessage {
    content: Buffer;
    fields: {
        consumerTag: string;
        deliveryTag: number;
        redelivered: boolean;
        exchange: string;
        routingKey: string;
    };
    properties: {
        contentType?: string;
        contentEncoding?: string;
        headers?: Record<string, any>;
        deliveryMode?: number;
        priority?: number;
        correlationId?: string;
        replyTo?: string;
        expiration?: string;
        messageId?: string;
        timestamp?: number;
        type?: string;
        userId?: string;
        appId?: string;
    };
}

/**
 * Options for asserting a queue.
 */
export interface AMQPQueueOptions {
    durable?: boolean;
    deadLetterExchange?: string;
    deadLetterRoutingKey?: string;
    messageTtl?: number;
    exclusive?: boolean;
    autoDelete?: boolean;
    arguments?: Record<string, any>;
}

/**
 * Options for asserting an exchange.
 */
export interface AMQPExchangeOptions {
    durable?: boolean;
    internal?: boolean;
    autoDelete?: boolean;
    alternateExchange?: string;
    arguments?: Record<string, any>;
}

/**
 * Options for publishing a message.
 */
export interface AMQPPublishOptions {
    correlationId?: string;
    messageId?: string;
    headers?: Record<string, any>;
    persistent?: boolean;
    expiration?: string | number;
    contentType?: string;
    contentEncoding?: string;
    priority?: number;
    replyTo?: string;
    timestamp?: number;
    type?: string;
    userId?: string;
    appId?: string;
}

/**
 * Options for consuming messages.
 */
export interface AMQPConsumeOptions {
    consumerTag?: string;
    noLocal?: boolean;
    noAck?: boolean;
    exclusive?: boolean;
    priority?: number;
    arguments?: Record<string, any>;
}

/**
 * Result of asserting a queue.
 */
export interface AMQPQueueInfo {
    queue: string;
    messageCount: number;
    consumerCount: number;
}

/**
 * Result of asserting an exchange.
 */
export interface AMQPExchangeInfo {
    exchange: string;
}

/**
 * Result of starting a consumer.
 */
export interface AMQPConsumeInfo {
    consumerTag: string;
}

/**
 * Abstraction over AMQP channel operations.
 * Decouples the application from specific AMQP client libraries (e.g., amqplib).
 */
export interface AMQPChannel {
    /**
     * Asserts a queue exists, creating it if necessary.
     */
    assertQueue(queue: string, options?: AMQPQueueOptions): Promise<AMQPQueueInfo>;

    /**
     * Checks if a queue exists.
     */
    checkQueue(queue: string): Promise<AMQPQueueInfo>;

    /**
     * Deletes a queue.
     */
    deleteQueue(queue: string, options?: { ifUnused?: boolean; ifEmpty?: boolean }): Promise<{ messageCount: number }>;

    /**
     * Asserts an exchange exists, creating it if necessary.
     */
    assertExchange(exchange: string, type: string, options?: AMQPExchangeOptions): Promise<AMQPExchangeInfo>;

    /**
     * Checks if an exchange exists.
     */
    checkExchange(exchange: string): Promise<AMQPExchangeInfo>;

    /**
     * Deletes an exchange.
     */
    deleteExchange(exchange: string, options?: { ifUnused?: boolean }): Promise<void>;

    /**
     * Binds a queue to an exchange with a routing pattern.
     */
    bindQueue(queue: string, source: string, pattern: string, args?: Record<string, any>): Promise<void>;

    /**
     * Publishes a message to an exchange.
     *
     * If `confirmSelect()` was called on this channel, the returned promise
     * resolves only after the broker acknowledges the message; if the broker
     * rejects, the promise rejects. Otherwise it resolves once the message is
     * flushed to the TCP socket.
     */
    publish(exchange: string, routingKey: string, content: Buffer, options?: AMQPPublishOptions): Promise<void>;

    /**
     * Enables publisher confirms on this channel. After this is called every
     * `publish()` waits for broker acknowledgement before resolving.
     * https://www.rabbitmq.com/confirms.html#publisher-confirms
     */
    confirmSelect(): Promise<void>;

    /**
     * Starts consuming messages from a queue.
     */
    consume(queue: string, onMessage: (msg: ConsumeMessage | null) => void, options?: AMQPConsumeOptions): Promise<AMQPConsumeInfo>;

    /**
     * Acknowledges a message.
     */
    ack(message: ConsumeMessage, allUpTo?: boolean): void;

    /**
     * Negatively acknowledges a message.
     */
    nack(message: ConsumeMessage, allUpTo?: boolean, requeue?: boolean): void;

    /**
     * Sets the prefetch count for the channel.
     */
    prefetch(count: number, global?: boolean): Promise<void>;

    /**
     * Closes the channel.
     */
    close(): Promise<void>;
}

export interface AMQPChannelLifecycleCallbacks {
    onError?: (err: any) => void;
    onClose?: () => void;
}

export interface AMQPClient {
    connect(): Promise<any>;

    getChannel(callbacks?: AMQPChannelLifecycleCallbacks): Promise<AMQPChannel>;

    getDefaultChannel(): Promise<AMQPChannel>;

    disconnect(): Promise<void>;

    isActive(): boolean;
}

export interface RunMQConnectionConfig {
    /**
     * The URL of the RabbitMQ server.
     */
    url: string;
    /**
     * The delay in milliseconds before attempting to reconnect after a disconnection.
     * Default is 5000 ms.
     */
    reconnectDelay?: number;
    /**
     * The maximum number of reconnection attempts before giving up.
     * Default is 10 attempts.
     */
    maxReconnectAttempts?: number;
    /**
     * Optional configuration for RabbitMQ management HTTP API.
     * If provided, policies will be used for TTL instead of queue-level TTL.
     */
    management?: {
        url: string;
        username: string;
        password: string;
    };
    /**
     * Controls publisher confirms on the user-publish path. When enabled
     * (default), `runMQ.publish()` resolves only after RabbitMQ acknowledges
     * each message, and rejects on broker error (e.g. mandatory routing
     * failure, alarm state). Set to `false` to opt out and fall back to
     * fire-and-forget — publish resolves once the message is written to the
     * TCP socket, with no delivery guarantee.
     *
     * Trade-off: confirms add a broker round-trip per publish (typically a
     * few hundred microseconds). They're the only way to detect silent
     * publish failures, so we default to safety. DLQ publishes from the
     * consumer chain are *always* confirmed regardless of this setting —
     * the message-loss risk there is not negotiable.
     */
    usePublisherConfirms?: boolean;
}

export type SchemaFailureStrategy = 'dlq'
export type SchemaType = 'ajv'

export interface RunMQProcessorConfiguration {
    /*
    The name of the processor.
     */
    name: string;
    /**
     * The number of concurrent consumers (independent AMQP channels) to run
     * for this processor.
     *
     * Each consumer holds its own channel with its own `prefetch` window, so
     * the maximum number of unacknowledged in-flight messages for the
     * processor is `consumersCount * prefetch` — not `prefetch` alone.
     * For example, `consumersCount: 10` with the default `prefetch: 20`
     * allows up to 200 messages to be held unacknowledged at once.
     *
     * Tune both values together to control memory footprint and the size of
     * the redelivery surface on a crash.
     */
    consumersCount: number;
    /**
     * The per-channel prefetch count applied to each consumer's channel.
     * Defaults to 20.
     *
     * NOTE: this is per-consumer, not per-processor. Total in-flight messages
     * for the processor is `consumersCount * prefetch`.
     */
    prefetch?: number;
    /**
     * The maximum number attempts processing a message, default is 1 attempt.
     */
    attempts?: number;
    /**
     * The delay in milliseconds between retry attempts.
     */
    attemptsDelay?: number;
    /**
     * The schema configuration for message validation.
     * if not provided, no schema validation will be performed.
     * @see MessageSchema
     */
    messageSchema?: MessageSchema

    /**
     * Whether to use RabbitMQ policies for setting the attempts delay instead of queue-level TTL.
     * Requires management configuration to be provided in RunMQConnectionConfig.
     * Default is false.
     *
     * Recommended to use it for flexibility.
     */
    usePoliciesForDelay?: boolean;
}

export interface RabbitMQManagementConfig {
    url: string;
    username: string;
    password: string;
}

export interface RabbitMQOperatorPolicy {
    name: string;
    pattern: string;
    definition: {
        "message-ttl"?: number;
        [key: string]: any;
    };
    priority?: number;
    "apply-to": "queues" | "exchanges" | "all";
}

export interface RunMQMessageContent<T = any> {
    /**
     * The actual message payload.
     */
    message: T;
    /**
     * Metadata associated with the message.
     * @see RunMQMessageMetaContent
     */
    meta: RunMQMessageMetaContent;
}

export interface RunMQMessageMetaContent {
    /**
     * The unique identifier of the message.
     */
    id: string;
    /**
     * The timestamp when the message was published.
     */
    publishedAt: number;
    /**
     * The correlation identifier.
     */
    correlationId: string;
}

export interface MessageSchema {
    /**
     * The type of schema used for validation (e.g., 'ajv').
     * @see SchemaType
     */
    type: SchemaType;
    /**
     * The schema definition of the chosen schemaType, used for validating messages
     */
    schema: any;
    /**
     * The strategy to apply when schema validation fails (e.g., 'dlq').
     * if the schema validation fails, the message will be routed to the dead-letter queue.
     * @see SchemaFailureStrategy
     */
    failureStrategy: SchemaFailureStrategy;
}

export interface RunMQConsumer {
    consume: (message: RabbitMQMessage) => Promise<boolean>;
}


export interface RunMQPublisher {
    publish: (topic: string, message: RabbitMQMessage) => Promise<void>;
}