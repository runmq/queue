import {RunMQConnectionConfig} from "@src/types";
import {RunMQException} from "@src/core/exceptions/RunMQException";
import {AmqplibClient} from "@src/core/clients/amqplibClient";
import {Exceptions} from "@src/core/exceptions/Exceptions";
import {RunMQUtils} from "@src/core/utils/Utils";

export class RunMQ {
    private readonly amqplibClient: AmqplibClient;
    private readonly config: RunMQConnectionConfig;
    private retryAttempts: number = 0;

    constructor(config: RunMQConnectionConfig) {
        this.amqplibClient = AmqplibClient.getInstance();
        this.config = {
            ...config,
            reconnectDelay: config.reconnectDelay ?? 5000,
            maxReconnectAttempts: config.maxReconnectAttempts ?? 5
        };
    }

    public async start(): Promise<void> {
        await this.connectWithRetry();
    }

    private async connectWithRetry(): Promise<void> {
        const maxAttempts = this.config.maxReconnectAttempts!;
        const delay = this.config.reconnectDelay!;

        while (this.retryAttempts < maxAttempts) {
            try {
                await this.amqplibClient.connect(this.config);
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
            console.error('Error during disconnect:', error);
            throw new RunMQException(
                Exceptions.CONNECTION_NOT_ESTABLISHED,
                {
                    error: error instanceof Error ? error.message : String(error)
                }
            );
        }
    }
}