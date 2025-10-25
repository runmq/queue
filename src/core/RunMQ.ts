import {RunMQProcessorConfiguration, RunMQConnectionConfig, RunMQPublisher} from "@src/types";
import {RunMQException} from "@src/core/exceptions/RunMQException";
import {AmqplibClient} from "@src/core/clients/AmqplibClient";
import {Exceptions} from "@src/core/exceptions/Exceptions";
import {RunMQUtils} from "@src/core/utils/Utils";
import {Constants} from "@src/core/constants";
import {RunMQMessage} from "@src/core/message/RunMQMessage"
import {Channel} from "amqplib";
import {RunMQConsumerCreator} from "@src/core/consumer/RunMQConsumerCreator";
import {ConsumerConfiguration} from "@src/core/consumer/ConsumerConfiguration";
import {RunMQLogger} from "@src/core/logging/RunMQLogger";
import {RunMQConsoleLogger} from "@src/core/logging/RunMQConsoleLogger";
import {RunMQPublisherCreator} from "@src/core/publisher/RunMQPublisherCreator";
import {RabbitMQMessage} from "@src/core/message/RabbitMQMessage";
import {RabbitMQMessageProperties} from "@src/core/message/RabbitMQMessageProperties";

export class RunMQ {
    private readonly amqplibClient: AmqplibClient;
    private readonly config: RunMQConnectionConfig;
    private publisher: RunMQPublisher | undefined
    private readonly logger: RunMQLogger
    private retryAttempts: number = 0;
    private defaultChannel: Channel | undefined;

    private constructor(config: RunMQConnectionConfig, logger: RunMQLogger) {
        this.logger = logger;
        this.config = {
            ...config,
            reconnectDelay: config.reconnectDelay ?? 5000,
            maxReconnectAttempts: config.maxReconnectAttempts ?? 5
        };
        this.amqplibClient = new AmqplibClient(this.config);
    }

    public static async start(config: RunMQConnectionConfig, logger: RunMQLogger = new RunMQConsoleLogger): Promise<RunMQ> {
        const instance = new RunMQ(config, logger);
        await instance.connectWithRetry();
        await instance.initialize();
        return instance;
    }

    public async process<T = Record<string, never>>(topic: string, config: RunMQProcessorConfiguration, processor: (message: RunMQMessage<T>) => Promise<void>) {
        const consumer = new RunMQConsumerCreator(this.defaultChannel!, this.amqplibClient, this.logger);
        await consumer.createConsumer<T>(new ConsumerConfiguration(topic, config, processor))
    }

    public publish(topic: string, message: any, correlationId: string = RunMQUtils.generateUUID()): void {
        if (!this.publisher) {
            throw new RunMQException(Exceptions.NOT_INITIALIZED, {});
        }
        this.publisher.publish(topic, RabbitMQMessage.from(
                message,
                this.defaultChannel!,
                new RabbitMQMessageProperties(RunMQUtils.generateUUID(), correlationId)
            )
        );
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

    private async connectWithRetry(): Promise<void> {
        const maxAttempts = this.config.maxReconnectAttempts!;
        const delay = this.config.reconnectDelay!;

        while (this.retryAttempts < maxAttempts) {
            try {
                await this.amqplibClient.connect();
                this.logger.log('Successfully connected to RabbitMQ');
                this.retryAttempts = 0;
                return;
            } catch (error) {
                this.retryAttempts++;
                this.logger.error(`Connection attempt ${this.retryAttempts}/${maxAttempts} failed:`, error);

                if (this.retryAttempts >= maxAttempts) {
                    throw new RunMQException(
                        Exceptions.EXCEEDING_CONNECTION_ATTEMPTS,
                        {
                            attempts: maxAttempts,
                            error: error instanceof Error ? error.message : String(error)
                        }
                    );
                }

                this.logger.error(`Retrying in ${delay}ms...`);
                await RunMQUtils.delay(delay);
            }
        }
    }

    private async initialize(): Promise<void> {
        this.defaultChannel = await this.amqplibClient.getChannel();
        await this.defaultChannel.assertExchange(Constants.ROUTER_EXCHANGE_NAME, 'direct', {durable: true});
        await this.defaultChannel.assertExchange(Constants.DEAD_LETTER_ROUTER_EXCHANGE_NAME, 'direct', {durable: true});
        this.publisher = new RunMQPublisherCreator(this.logger).createPublisher();
    }
}