import {AMQPChannel, AMQPClient} from "@src/types";

export class MockedAMQPClient implements AMQPClient {
    constructor(private channel: AMQPChannel) {

    }

    public connect = jest.fn();
    public getChannel = jest.fn().mockResolvedValue(this.channel);
    public getDefaultChannel = jest.fn().mockResolvedValue(this.channel);
    public disconnect = jest.fn();
    public isActive = jest.fn();
}