import {
    AMQPChannel,
    AMQPConsumeInfo,
    AMQPConsumeOptions,
    AMQPExchangeInfo,
    AMQPExchangeOptions,
    AMQPPublishOptions,
    AMQPQueueInfo,
    AMQPQueueOptions,
    ConsumeMessage
} from "@src/types";

export class MockedAMQPChannel implements AMQPChannel {
    assertQueue = jest.fn<Promise<AMQPQueueInfo>, [string, AMQPQueueOptions?]>().mockResolvedValue({
        queue: 'test-queue',
        messageCount: 0,
        consumerCount: 0
    });

    checkQueue = jest.fn<Promise<AMQPQueueInfo>, [string]>().mockResolvedValue({
        queue: 'test-queue',
        messageCount: 0,
        consumerCount: 0
    });

    deleteQueue = jest.fn<Promise<{ messageCount: number }>, [string, { ifUnused?: boolean; ifEmpty?: boolean }?]>().mockResolvedValue({
        messageCount: 0
    });

    assertExchange = jest.fn<Promise<AMQPExchangeInfo>, [string, string, AMQPExchangeOptions?]>().mockResolvedValue({
        exchange: 'test-exchange'
    });

    checkExchange = jest.fn<Promise<AMQPExchangeInfo>, [string]>().mockResolvedValue({
        exchange: 'test-exchange'
    });

    deleteExchange = jest.fn<Promise<void>, [string, { ifUnused?: boolean }?]>().mockResolvedValue();

    bindQueue = jest.fn<Promise<void>, [string, string, string, Record<string, any>?]>().mockResolvedValue();

    publish = jest.fn<boolean, [string, string, Buffer, AMQPPublishOptions?]>().mockReturnValue(true);

    consume = jest.fn<Promise<AMQPConsumeInfo>, [string, (msg: ConsumeMessage | null) => void, AMQPConsumeOptions?]>().mockResolvedValue({
        consumerTag: 'test-consumer-tag'
    });

    ack = jest.fn<void, [ConsumeMessage, boolean?]>();

    nack = jest.fn<void, [ConsumeMessage, boolean?, boolean?]>();

    prefetch = jest.fn<Promise<void>, [number, boolean?]>().mockResolvedValue();

    close = jest.fn<Promise<void>, []>().mockResolvedValue();
}

export class MockedAMQPChannelWithAcknowledgeFailure extends MockedAMQPChannel {
    ack = jest.fn().mockImplementation(() => {
        throw new Error("Acknowledgement failed");
    });
}

