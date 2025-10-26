import {Channel, Connection} from "amqplib";

export class MockedRabbitMQChannel implements Channel {
    unbindQueue = jest.fn();
    bindQueue = jest.fn();
    purgeQueue = jest.fn();
    deleteQueue = jest.fn();
    checkQueue = jest.fn();
    assertQueue = jest.fn();
    unbindExchange = jest.fn();
    bindExchange = jest.fn();
    deleteExchange = jest.fn();
    checkExchange = jest.fn();
    assertExchange = jest.fn();
    publish = jest.fn();
    sendToQueue = jest.fn();
    consume = jest.fn();
    cancel = jest.fn();
    get = jest.fn();
    ack = jest.fn();
    ackAll = jest.fn();
    nack = jest.fn();
    nackAll = jest.fn();
    reject = jest.fn();
    prefetch = jest.fn();
    recover = jest.fn();
    close = jest.fn();
    connection: Connection = {} as Connection;
    addListener = jest.fn();
    on = jest.fn();
    once = jest.fn();
    removeListener = jest.fn();
    off = jest.fn();
    removeAllListeners = jest.fn();
    setMaxListeners = jest.fn();
    getMaxListeners = jest.fn();
    listeners = jest.fn();
    rawListeners = jest.fn();
    emit = jest.fn();
    listenerCount = jest.fn();
    eventNames = jest.fn();
    prependListener = jest.fn();
    prependOnceListener = jest.fn();
}

export class MockedRabbitMQChannelWithAcknowledgeFailure extends MockedRabbitMQChannel {
    ack = jest.fn().mockImplementation(() => {
        throw new Error("Acknowledgement failed");
    });
}