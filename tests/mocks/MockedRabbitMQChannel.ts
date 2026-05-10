import {AMQPChannel} from "@src/types";
import {Connection} from "rabbitmq-client";

export class MockedRabbitMQChannel implements AMQPChannel {
    bindQueue = jest.fn();
    deleteQueue = jest.fn();
    checkQueue = jest.fn();
    assertQueue = jest.fn();
    deleteExchange = jest.fn();
    checkExchange = jest.fn();
    assertExchange = jest.fn();
    publish = jest.fn().mockResolvedValue(undefined);
    consume = jest.fn();
    get = jest.fn();
    ack = jest.fn();
    nack = jest.fn();
    prefetch = jest.fn();
    confirmSelect = jest.fn().mockResolvedValue(undefined);
    close = jest.fn();
    connection: Connection = {} as Connection;
    on = jest.fn();
    off = jest.fn();
}

export class MockedRabbitMQChannelWithAcknowledgeFailure extends MockedRabbitMQChannel {
    ack = jest.fn().mockImplementation(() => {
        throw new Error("Acknowledgement failed");
    });
}