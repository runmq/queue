import {RunMQBaseProducer} from '@src/core/publisher/producers/RunMQBaseProducer';
import {DefaultSerializer} from '@src/core/serializers/DefaultSerializer';
import {RunMQMessage, RunMQMessageMeta} from '@src/core/message/RunMQMessage';
import {Constants} from '@src/core/constants';
import {Channel} from 'amqplib';
import {RabbitMQMessage} from "@src/core/message/RabbitMQMessage";
import {RabbitMQMessageProperties} from "@src/core/message/RabbitMQMessageProperties";

jest.mock('@src/core/serializers/DefaultSerializer');
jest.mock('@src/core/message/RunMQMessage', () => ({
    RunMQMessage: jest.fn().mockImplementation((message, meta) => ({
        message,
        meta
    })),
    RunMQMessageMeta: jest.fn().mockImplementation((id, publishedAt, correlationId) => ({
        id,
        publishedAt,
        correlationId,
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

        producer = new RunMQBaseProducer(mockSerializer, Constants.ROUTER_EXCHANGE_NAME);
    });

    describe('publish', () => {
        it('should create RunMQMessage with generated ID and current timestamp', () => {
            const testMessage = RabbitMQMessage.from(
                {name: 'Test Message'},
                mockChannel,
                new RabbitMQMessageProperties(
                    "id",
                    "correlation-id"
                ));
            const testTopic = 'test.topic';

            producer.publish(testTopic, testMessage);

            expect(RunMQMessage).toHaveBeenCalledWith(
                testMessage.message,
                expect.objectContaining<RunMQMessageMeta>({
                    id: testMessage.id,
                    publishedAt: expect.any(Number),
                    correlationId: testMessage.correlationId,
                })
            );
        });

        it('should serialize the RunMQMessage', () => {
            const testMessage = RabbitMQMessage.from(
                {name: 'Test Message'},
                mockChannel,
                new RabbitMQMessageProperties(
                    "id",
                    "correlation-id"
                ));
            const testTopic = 'test.topic';

            producer.publish(testTopic, testMessage);

            expect(mockSerializer.serialize).toHaveBeenCalledTimes(1);
            expect(mockSerializer.serialize).toHaveBeenCalledWith(
                expect.objectContaining({
                    message: testMessage.message,
                    meta: expect.objectContaining({
                        id: testMessage.id,
                        publishedAt: expect.any(Number),
                        correlationId: testMessage.correlationId,
                    })
                })
            );
        });

        it('should publish to the correct exchange and routing key', () => {
            const testMessage = RabbitMQMessage.from(
                {name: 'Test Message'},
                mockChannel,
                new RabbitMQMessageProperties(
                    "id",
                    "correlation-id"
                ));
            const testTopic = 'test.topic';
            const serializedMessage = '{"message":"test","meta":{"id":"test-id","publishedAt":1234567890}}';

            producer.publish(testTopic, testMessage);

            expect(mockChannel.publish).toHaveBeenCalledWith(
                Constants.ROUTER_EXCHANGE_NAME,
                testTopic,
                Buffer.from(serializedMessage),
                {
                    correlationId: testMessage.correlationId,
                    messageId: testMessage.id,
                    headers: testMessage.headers,
                }
            );
        });

        it('should handle different message types', () => {
            const stringMessage = RabbitMQMessage.from(
                'Test Message',
                mockChannel,
                new RabbitMQMessageProperties(
                    "id",
                    "correlation-id"
                ));
            const numberMessage = RabbitMQMessage.from(
                45,
                mockChannel,
                new RabbitMQMessageProperties(
                    "id",
                    "correlation-id"
                ));
            const objectMessage = RabbitMQMessage.from(
                {complex: {nested: 'data'}},
                mockChannel,
                new RabbitMQMessageProperties(
                    "id",
                    "correlation-id"
                ));
            const testTopic = 'test.topic';

            producer.publish(testTopic, stringMessage);
            producer.publish(testTopic, numberMessage);
            producer.publish(testTopic, objectMessage);

            expect(RunMQMessage).toHaveBeenCalledTimes(3);
            expect(mockChannel.publish).toHaveBeenCalledTimes(3);
        });

        it('should handle empty and null messages', () => {
            const testTopic = 'test.topic';
            const nullMessage = RabbitMQMessage.from(
                'Test Message',
                mockChannel,
                new RabbitMQMessageProperties(
                    "id",
                    "correlation-id"
                )
            );
            const undefinedMessage = RabbitMQMessage.from(
                'Test Message',
                mockChannel,
                new RabbitMQMessageProperties(
                    "id",
                    "correlation-id"
                )
            );
            const emptyMessage = RabbitMQMessage.from(
                'Test Message',
                mockChannel,
                new RabbitMQMessageProperties(
                    "id",
                    "correlation-id"
                )
            );
            producer.publish(testTopic, nullMessage);
            producer.publish(testTopic, undefinedMessage);
            producer.publish(testTopic, emptyMessage);

            expect(RunMQMessage).toHaveBeenCalledTimes(3);
            expect(mockChannel.publish).toHaveBeenCalledTimes(3);
        });
    });
});
