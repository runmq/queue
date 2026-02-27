import jest from 'jest-mock';
import {ConsumeMessage} from "@src/types";

export const MockedAmqpMessage = {
    content: Buffer.from('mocked message'),
    fields: {
        consumerTag: 'test-consumer-tag',
        deliveryTag: 1,
        redelivered: false,
        exchange: 'test-exchange',
        routingKey: 'test-routing-key',
    },
    properties: {},
} as unknown as jest.Mocked<ConsumeMessage>;
