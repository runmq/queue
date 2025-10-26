import {RunMQBaseProducer} from '@src/core/publisher/producers/RunMQBaseProducer';
import {RunMQMessage, RunMQMessageMeta} from '@src/core/message/RunMQMessage';
import {Constants} from '@src/core/constants';
import {RabbitMQMessage} from "@src/core/message/RabbitMQMessage";
import {RabbitMQMessageProperties} from "@src/core/message/RabbitMQMessageProperties";
import {MockedRabbitMQChannel} from "@tests/mocks/MockedRabbitMQChannel";
import {MockedRabbitMQMessage, mockedRabbitMQMessageWithChannelAndMessage} from "@tests/mocks/MockedRabbitMQMessage";
import {MockedDefaultSerializer} from "@tests/mocks/MockedDefaultSerializer";
import {RunMQMessageExample} from "@tests/Examples/RunMQMessageExample";

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
    const mockedChannel = new MockedRabbitMQChannel();
    const mockedSerializer = new MockedDefaultSerializer();
    const producer: RunMQBaseProducer = new RunMQBaseProducer(mockedSerializer, Constants.ROUTER_EXCHANGE_NAME);

    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('publish', () => {
        it('should create RunMQMessage with generated ID and current timestamp', () => {
            const testMessage = MockedRabbitMQMessage;
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
            const testMessage = MockedRabbitMQMessage;
            const testTopic = 'test.topic';

            producer.publish(testTopic, testMessage);

            expect(mockedSerializer.serialize).toHaveBeenCalledTimes(1);
            expect(mockedSerializer.serialize).toHaveBeenCalledWith(
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
            jest.useFakeTimers().setSystemTime(new Date('2025-10-10T00:00:00Z'));
            const message = RunMQMessageExample.person();
            const testMessage = mockedRabbitMQMessageWithChannelAndMessage(
                mockedChannel,
                message.message,
                message.meta.id,
                message.meta.correlationId
            );
            const testTopic = 'test.topic';
            const serializedMessage = JSON.stringify(message);

            producer.publish(testTopic, testMessage);

            expect(mockedChannel.publish).toHaveBeenCalledWith(
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
    });
});
