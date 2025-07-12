export interface RunMQConnectionConfig {
    url: string;
    reconnectDelay?: number;
    maxReconnectAttempts?: number;
}