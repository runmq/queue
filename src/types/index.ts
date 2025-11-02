import {RabbitMQMessage} from "@src/core/message/RabbitMQMessage";
import {Channel, ChannelModel} from "amqplib";

export interface AMQPClient {
    connect(): Promise<ChannelModel>;

    getChannel(): Promise<Channel>

    disconnect(): Promise<void>

    isActive(): boolean
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
}

export type SchemaFailureStrategy = 'dlq'
export type SchemaType = 'ajv'

export interface RunMQProcessorConfiguration {
    /*
    The name of the processor.
     */
    name: string;
    /**
     * The number of concurrent consumers to run for this processor.
     */
    consumersCount: number;
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
    publish: (topic: string, message: RabbitMQMessage) => void;
}