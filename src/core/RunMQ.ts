import {RunMQConnectionConfig} from "@src/types";
import {RunMQException} from "@src/core/exceptions/RunMQException";
import {AmqplibClient} from "@src/core/clients/AmqplibClient";
import {Exceptions} from "@src/core/exceptions/Exceptions";
import {RunMQUtils} from "@src/core/utils/Utils";

export class RunMQ {
    private readonly amqplibClient: AmqplibClient;
    private readonly config: RunMQConnectionConfig;
    private retryAttempts: number = 0;

    private constructor(config: RunMQConnectionConfig) {
        this.config = {
            ...config,
            reconnectDelay: config.reconnectDelay ?? 5000,
            maxReconnectAttempts: config.maxReconnectAttempts ?? 5
        };
        this.amqplibClient = new AmqplibClient(this.config);
    }

    public static async start(config: RunMQConnectionConfig): Promise<RunMQ> {
        const instance = new RunMQ(config);
        await instance.connectWithRetry();
        return instance;
    }

    private async connectWithRetry(): Promise<void> {
        const maxAttempts = this.config.maxReconnectAttempts!;
        const delay = this.config.reconnectDelay!;

        while (this.retryAttempts < maxAttempts) {
            try {
                await this.amqplibClient.connect();
                console.log('Successfully connected to RabbitMQ');
                this.retryAttempts = 0;
                return;
            } catch (error) {
                this.retryAttempts++;
                console.error(`Connection attempt ${this.retryAttempts}/${maxAttempts} failed:`, error);

                if (this.retryAttempts >= maxAttempts) {
                    throw new RunMQException(
                        Exceptions.EXCEEDING_CONNECTION_ATTEMPTS,
                        {
                            attempts: maxAttempts,
                            error: error instanceof Error ? error.message : String(error)
                        }
                    );
                }

                console.log(`Retrying in ${delay}ms...`);
                await RunMQUtils.delay(delay);
            }
        }
    }

    public async disconnect(): Promise<void> {
        try {
            await this.amqplibClient.disconnect();
        } catch (error) {
            throw new RunMQException(
                Exceptions.CONNECTION_NOT_ESTABLISHED,
                {
                    error: error instanceof Error ? error.message : String(error)
                }
            );
        }
    }

    public isActive(): boolean {
        return this.amqplibClient.isActive();
    }
}