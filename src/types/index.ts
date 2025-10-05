import {RabbitMQMessage} from "@src/core/message/RabbitMQMessage";

export interface RunMQConnectionConfig {
    url: string;
    reconnectDelay?: number;
    maxReconnectAttempts?: number;
}

type SchemaFailureStrategy = 'dlq'
export type SchemaType = 'ajv'

export interface RunMQProcessorConfiguration {
    name: string;
    consumersCount: number;
    maxRetries?: number;
    retryDelay?: number;
    messageSchema?: {
        type: SchemaType,
        schema: any,
        failureStrategy: SchemaFailureStrategy
    }
}

export interface RunMQConsumer {
    consume: (message: RabbitMQMessage) => Promise<boolean>;
}


export interface RunMQPublisher {
    publish: (topic: string, message: any) => void;
}