import {ChannelModel, connect as amqpConnect} from "amqplib";
import {ConnectionStrategy, ConnectionStrategyConnectResult, RunMQConnectionConfig} from "@src/types";
import {Exceptions} from "@src/core/exceptions/Exceptions";
import {RunMQException} from "@src/core/exceptions/RunMQException";
import {RunMQUtils} from "@src/core/utils/Utils";

export class AmqplibConnector implements ConnectionStrategy {
    private static instance: AmqplibConnector;
    private connection: ChannelModel | undefined;

    private constructor() {
    }

    public static getInstance(): AmqplibConnector {
        if (!AmqplibConnector.instance) {
            AmqplibConnector.instance = new AmqplibConnector();
        }
        return AmqplibConnector.instance;
    }

    public async getConnection(): Promise<ChannelModel> {
        if (!this.connection) {
            throw new RunMQException(Exceptions.CONNECTION_NOT_ESTABLISHED, {
                message: 'Connection not established. Call connect() first.'
            });
        }
        return this.connection;
    }

    public async connect(config: RunMQConnectionConfig): Promise<ConnectionStrategyConnectResult> {
        if (this.connection) {
            return this.connection;
        }

        const maxAttempts = config.maxReconnectAttempts ?? 10;
        const delay = config.reconnectDelay ?? 5000;

        return this.connectWithRetry(config.url, maxAttempts, delay);
    }

    private async connectWithRetry(url: string, maxAttempts: number, delay: number): Promise<ConnectionStrategyConnectResult> {
        let lastError: Error | undefined;

        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            try {
                console.log(`[RunMQ]: Connection attempt ${attempt}/${maxAttempts}`);
                this.connection = await amqpConnect(url);
                console.log('[RunMQ]: Connected to RabbitMQ');
                return this.connection;
            } catch (error) {
                lastError = error as Error;
                console.error(`[RunMQ]: Failed to connect to RabbitMQ (attempt ${attempt}/${maxAttempts}):`, error);

                if (attempt < maxAttempts) {
                    console.log(`[RunMQ]: Retrying in ${delay}ms...`);
                    await RunMQUtils.sleep(delay);
                }
            }
        }

         throw new RunMQException(Exceptions.EXCEEDING_CONNECTION_ATTEMPTS, {
            attempts: maxAttempts,
            lastError: lastError?.message || 'Unknown error'
        });
    }
}