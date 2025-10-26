import * as amqp from "amqplib";
import {RunMQException} from "@src/core/exceptions/RunMQException";
import {Exceptions} from "@src/core/exceptions/Exceptions";
import {Channel, ChannelModel} from "amqplib";
import {AMQPClient, RunMQConnectionConfig} from "@src/types";

export class AmqplibClient implements AMQPClient {
    private channelModel: ChannelModel | undefined;
    private isConnected: boolean = false;

    constructor(private config: RunMQConnectionConfig) {
        this.config = config
    }

    public async connect(): Promise<ChannelModel> {
        try {
            if (this.isConnected && this.channelModel) {
                return this.channelModel;
            }

            this.channelModel = await amqp.connect(this.config.url);
            this.isConnected = true;

            if (this.isConnected) {
                this.channelModel.on('error', () => {
                    // TODO:: handle error (reconnect logic?)
                    this.isConnected = false;
                });

                this.channelModel.on('close', () => {
                    // TODO:: ensure safe close (publishers/consumers closed)
                    this.isConnected = false;
                });
            }
            return this.channelModel;
        } catch (error) {
            this.isConnected = false;
            throw new RunMQException(
                Exceptions.CONNECTION_NOT_ESTABLISHED,
                {
                    error: error instanceof Error ? error.message : String(error)
                }
            );
        }
    }
    public async getChannel(): Promise<Channel> {
        return await (await this.connect()).createChannel()
    }
    public async disconnect(): Promise<void> {
        try {
            if (this.channelModel && this.isConnected) {
                await this.channelModel.close();
                this.isConnected = false;
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

    public isActive(): boolean {
        return this.isConnected && this.channelModel !== undefined;
    }
}