import {ChannelModel} from "amqplib";
import {RunMQException} from "@src/core/exceptions/RunMQException";

export interface ConnectionStrategy {
    getConnection(): Promise<ChannelModel>;
    connect(config: RunMQConnectionConfig): Promise<ConnectionStrategyConnectResult>;
}


export type ConnectionStrategyConnectResult = ChannelModel |  RunMQException;

export interface RunMQConnectionConfig {
    url: string;
    reconnectDelay?: number;
    maxReconnectAttempts?: number;
}