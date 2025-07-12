import * as amqp from "amqplib";
import {RunMQConnectionConfig} from "@src/types";
import {RunMQException} from "@src/core/exceptions/RunMQException";
import {Exceptions} from "@src/core/exceptions/Exceptions";
import {ChannelModel} from "amqplib";

export class AmqplibClient {
    private static instance: AmqplibClient;
    private connection: ChannelModel | undefined;
    private isConnected: boolean = false;

    private constructor() {
    }

    public static getInstance(): AmqplibClient {
        if (!AmqplibClient.instance) {
            AmqplibClient.instance = new AmqplibClient();
        }
        return AmqplibClient.instance;
    }

    public async connect(config: RunMQConnectionConfig): Promise<void> {
        try {
            if (this.isConnected && this.connection) {
                console.log('Already connected to RabbitMQ');
                return;
            }

            this.connection = await amqp.connect(config.url);
            this.isConnected = true;

            if (this.connection) {
                this.connection.on('error', (err: Error) => {
                    console.error('RabbitMQ connection error:', err);
                    this.isConnected = false;
                });

                this.connection.on('close', () => {
                    console.log('RabbitMQ connection closed');
                    this.isConnected = false;
                });
            }
        } catch (error) {
            this.isConnected = false;
            throw new RunMQException(
                Exceptions.CONNECTION_NOT_ESTABLISHED,
                {
                    url: config.url,
                    error: error instanceof Error ? error.message : String(error)
                }
            );
        }
    }

    public async disconnect(): Promise<void> {
        try {
            if (this.connection && this.isConnected) {
                await this.connection.close();
                this.connection = undefined;
                this.isConnected = false;
                console.log('Disconnected from RabbitMQ');
            }
        } catch (error) {
            throw new RunMQException(
                Exceptions.CONNECTION_NOT_ESTABLISHED,
                {
                    error: error instanceof Error ? error.message : String(error)
                }
            );
        }
    }

    public async getConnection(): Promise<ChannelModel | undefined> {
        if (!this.isConnected || !this.connection) {
            throw new RunMQException(
                Exceptions.CONNECTION_NOT_ESTABLISHED,
                {
                    message: 'Connection not established. Call connect() first.'
                }
            );
        }
        return this.connection;
    }

    public isConnectionActive(): boolean {
        return this.isConnected && this.connection !== undefined;
    }
}