import {RabbitMQMessage} from "@src/core/message/RabbitMQMessage";
import {Channel, ChannelModel} from "amqplib";

export interface AMQPClient {
    connect():  Promise<ChannelModel>;
    getChannel(): Promise<Channel>
    disconnect(): Promise<void>
    isActive(): boolean
}

export interface RunMQConnectionConfig {
    url: string;
    reconnectDelay?: number;
    maxReconnectAttempts?: number;
}

export type SchemaFailureStrategy = 'dlq'
export type SchemaType = 'ajv'

export interface RunMQProcessorConfiguration {
    name: string;
    consumersCount: number;
    maxRetries?: number;
    retryDelay?: number;
    messageSchema?: MessageSchema
}

export interface MessageSchema {
    type: SchemaType;
    schema: any;
    failureStrategy: SchemaFailureStrategy;
}

export interface RunMQConsumer {
    consume: (message: RabbitMQMessage) => Promise<boolean>;
}


export interface RunMQPublisher {
    publish: (topic: string, message: RabbitMQMessage) => void;
}