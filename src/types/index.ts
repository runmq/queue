import {ClassConstructor} from "class-transformer/types/interfaces";
import {RabbitMQMessage} from "@src/core/message/RabbitMQMessage";

export interface RunMQConnectionConfig {
    url: string;
    reconnectDelay?: number;
    maxReconnectAttempts?: number;
}

export interface RunMQProcessorConfiguration<T> {
    name: string;
    consumersCount: number;
    maxRetries?: number;
    retryDelay?: number;
    cls?: ClassConstructor<T>;
}

export interface RunMQConsumer {
    consume: (message: RabbitMQMessage) => boolean;
}