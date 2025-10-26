import { Message } from "amqplib";
import jest from 'jest-mock';

export const MockedAmqpMessage = {
    content: Buffer.from('mocked message'),
    fields: {},
    properties: {},
} as unknown as jest.Mocked<Message>;