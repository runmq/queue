import amqplib, {ChannelModel, Channel} from "amqplib";
import {RunMQException} from "@src/core/exceptions/RunMQException";
import {Exceptions} from "@src/core/exceptions/Exceptions";
import {AMQPChannel, AMQPClient, RunMQConnectionConfig} from "@src/types";
import {AmqplibChannel} from "@src/core/clients/AmqplibChannel";
import {RunMQLogger} from "@src";
import {RunMQConsoleLogger} from "@src/core/logging/RunMQConsoleLogger";

/**
 * AMQPClient implementation using amqplib library.
 */
export class AmqplibClientAdapter implements AMQPClient {
    private connection: ChannelModel | undefined;
    private defaultChannel: AMQPChannel | undefined;
    private isConnected: boolean = false;
    private acquiredChannels: Channel[] = [];

    constructor(private config: RunMQConnectionConfig, private logger: RunMQLogger = new RunMQConsoleLogger()) {
    }

    public async connect(): Promise<ChannelModel> {
        try {
            if (this.connection && this.isConnected) {
                return this.connection;
            }

            // Close any existing connection that might be in a bad state
            if (this.connection) {
                try {
                    await this.connection.close();
                } catch {
                    // Ignore close errors
                }
                this.connection = undefined;
            }

            const connection = await amqplib.connect(this.config.url);
            this.connection = connection;

            this.connection.on('error', (err: Error) => {
                this.logger.error('RabbitMQ connection error:', {error: err});
                this.isConnected = false;
            });

            this.connection.on('close', () => {
                this.isConnected = false;
            });

            this.isConnected = true;

            return this.connection;
        } catch (error) {
            this.isConnected = false;
            this.connection = undefined;
            throw new RunMQException(
                Exceptions.CONNECTION_NOT_ESTABLISHED,
                {
                    error: error instanceof Error ? error.message : JSON.stringify(error)
                }
            );
        }
    }

    public async getChannel(): Promise<AMQPChannel> {
        const connection = await this.connect();
        const rawChannel = await connection.createChannel();
        this.acquiredChannels.push(rawChannel);
        return new AmqplibChannel(rawChannel);
    }

    public async getDefaultChannel(): Promise<AMQPChannel> {
        if (!this.defaultChannel) {
            this.defaultChannel = await this.getChannel();
        }
        return this.defaultChannel;
    }

    public async disconnect(): Promise<void> {
        const conn = this.connection;
        const channels = this.acquiredChannels;

        this.connection = undefined;
        this.defaultChannel = undefined;
        this.isConnected = false;
        this.acquiredChannels = [];

        for (const channel of channels) {
            try {
                await channel.close();
            } catch {
                // Ignore errors - channel might already be closed
            }
        }

        if (conn) {
            try {
                await conn.close();
            } catch {
                // Ignore errors - connection might already be closed
            }
        }
    }

    public isActive(): boolean {
        return this.connection !== undefined && this.isConnected;
    }
}
