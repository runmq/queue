import {AMQPClient} from "@src/types";
import {Channel} from "amqplib";

export class MockedAMQPClient implements AMQPClient {
    constructor(private channel: Channel) {

    }

    public connect = jest.fn();
    public getChannel = jest.fn().mockResolvedValue(this.channel)
    public disconnect = jest.fn();
    public isActive = jest.fn();
}