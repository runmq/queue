import {RunMQBaseProducer} from '@src/core/publisher/producers/RunMQBaseProducer';
import {DefaultSerializer} from '@src/core/serializers/DefaultSerializer';
import {RunMQMessage} from '@src/core/message/RunMQMessage';
import {Constants} from '@src/core/constants';
import {Channel} from 'amqplib';

jest.mock('@src/core/serializers/DefaultSerializer');
jest.mock('@src/core/message/RunMQMessage', () => ({
    RunMQMessage: jest.fn().mockImplementation((message, meta) => ({
        message,
        meta
    })),
    RunMQMessageMeta: jest.fn().mockImplementation((id, publishedAt) => ({
        id,
        publishedAt
    }))
}));

describe('RunMQBaseProducer Unit Tests', () => {
    let mockChannel: jest.Mocked<Channel>;
    let mockSerializer: jest.Mocked<DefaultSerializer>;
    let producer: RunMQBaseProducer;

    beforeEach(() => {
        jest.clearAllMocks();

        mockChannel = {
            publish: jest.fn()
        } as any;

        mockSerializer = {
            serialize: jest.fn().mockReturnValue('{"message":"test","meta":{"id":"test-id","publishedAt":1234567890}}')
        } as any;

        producer = new RunMQBaseProducer(mockChannel, mockSerializer);
    });

    describe('publish', () => {
        it('should create RunMQMessage with generated ID and current timestamp', () => {
            const testMessage = {name: 'Test Message', value: 42};
            const testTopic = 'test.topic';

            producer.publish(testTopic, testMessage);

            expect(RunMQMessage).toHaveBeenCalledWith(
                testMessage,
                expect.objectContaining({
                    id: expect.any(String),
                    publishedAt: expect.any(Number)
                })
            );
        });

        it('should generate unique IDs for each message', () => {
            const testMessage1 = {name: 'Message 1'};
            const testMessage2 = {name: 'Message 2'};
            const testTopic = 'test.topic';

            producer.publish(testTopic, testMessage1);
            producer.publish(testTopic, testMessage2);

            const firstCall = (RunMQMessage as unknown as jest.Mock).mock.calls[0];
            const secondCall = (RunMQMessage as unknown as jest.Mock).mock.calls[1];

            expect(firstCall[1].id).not.toBe(secondCall[1].id);
        });

        it('should serialize the RunMQMessage', () => {
            const testMessage = {name: 'Test Message'};
            const testTopic = 'test.topic';

            producer.publish(testTopic, testMessage);

            expect(mockSerializer.serialize).toHaveBeenCalledTimes(1);
            expect(mockSerializer.serialize).toHaveBeenCalledWith(
                expect.objectContaining({
                    message: testMessage,
                    meta: expect.objectContaining({
                        id: expect.any(String),
                        publishedAt: expect.any(Number)
                    })
                })
            );
        });

        it('should publish to the correct exchange and routing key', () => {
            const testMessage = {name: 'Test Message'};
            const testTopic = 'test.topic';
            const serializedMessage = '{"message":"test","meta":{"id":"test-id","publishedAt":1234567890}}';

            producer.publish(testTopic, testMessage);

            expect(mockChannel.publish).toHaveBeenCalledWith(
                Constants.ROUTER_EXCHANGE_NAME,
                testTopic,
                Buffer.from(serializedMessage)
            );
        });

        it('should handle different message types', () => {
            const stringMessage = 'Simple string message';
            const numberMessage = 42;
            const objectMessage = {complex: {nested: 'data'}};
            const testTopic = 'test.topic';

            producer.publish(testTopic, stringMessage);
            producer.publish(testTopic, numberMessage);
            producer.publish(testTopic, objectMessage);

            expect(RunMQMessage).toHaveBeenCalledTimes(3);
            expect(mockChannel.publish).toHaveBeenCalledTimes(3);
        });

        it('should handle empty and null messages', () => {
            const testTopic = 'test.topic';

            producer.publish(testTopic, null);
            producer.publish(testTopic, undefined);
            producer.publish(testTopic, '');

            expect(RunMQMessage).toHaveBeenCalledTimes(3);
            expect(mockChannel.publish).toHaveBeenCalledTimes(3);
        });
    });
});
