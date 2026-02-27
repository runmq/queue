import {Connection, Channel} from "rabbitmq-client";
import {RunMQException} from "@src/core/exceptions/RunMQException";
import {Exceptions} from "@src/core/exceptions/Exceptions";
import {AMQPChannel, AMQPClient, RunMQConnectionConfig} from "@src/types";
import {RabbitMQClientChannel} from "@src/core/clients/RabbitMQClientChannel";

/**
 * AMQPClient implementation using rabbitmq-client library.
 * Leverages built-in reconnection, retry, and robustness features.
 */
export class RabbitMQClientAdapter implements AMQPClient {
    private connection: Connection | undefined;
    private defaultChannel: AMQPChannel | undefined;
    private isConnected: boolean = false;
    private acquiredChannels: Channel[] = [];

    constructor(private config: RunMQConnectionConfig) {}

    public async connect(): Promise<Connection> {
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

            this.connection = new Connection({
                url: this.config.url,
                // Disable automatic retries - we handle retries at RunMQ level
                retryLow: 100,
                retryHigh: 200,
                connectionTimeout: 5000,
            });

            // Set up event handlers before waiting for connection
            this.connection.on('error', (err) => {
                console.error('RabbitMQ connection error:', err);
                this.isConnected = false;
            });

            this.connection.on('connection', () => {
                this.isConnected = true;
            });

            this.connection.on('connection.blocked', (reason) => {
                console.warn('RabbitMQ connection blocked:', reason);
            });

            this.connection.on('connection.unblocked', () => {
                console.info('RabbitMQ connection unblocked');
            });

            // Wait for connection with timeout
            // The second parameter (true) disables auto-close on timeout
            await this.connection.onConnect(5000, true);
            this.isConnected = true;

            return this.connection;
        } catch (error) {
            this.isConnected = false;
            // Clean up the connection on failure
            if (this.connection) {
                try {
                    this.connection.close();
                } catch {
                    // Ignore
                }
                this.connection = undefined;
            }
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
        const rawChannel = await connection.acquire();
        // Track the channel so we can close it on disconnect
        this.acquiredChannels.push(rawChannel);
        return new RabbitMQClientChannel(rawChannel);
    }

    public async getDefaultChannel(): Promise<AMQPChannel> {
        if (!this.defaultChannel) {
            this.defaultChannel = await this.getChannel();
        }
        return this.defaultChannel;
    }

    public async disconnect(): Promise<void> {
        // Reset state first
        const conn = this.connection;
        const channels = this.acquiredChannels;

        this.connection = undefined;
        this.defaultChannel = undefined;
        this.isConnected = false;
        this.acquiredChannels = [];

        // Close all acquired channels first
        for (const channel of channels) {
            try {
                if (channel.active) {
                    await channel.close();
                }
            } catch {
                // Ignore errors - channel might already be closed
            }
        }

        // Now close the connection
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

