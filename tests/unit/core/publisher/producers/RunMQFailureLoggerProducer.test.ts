import {RunMQFailureLoggerProducer} from '@src/core/publisher/producers/RunMQFailureLoggerProducer';
import {MockedRabbitMQPublisher} from "@tests/mocks/MockedRunMQPublisher";
import {MockedRunMQLogger} from "@tests/mocks/MockedRunMQLogger";
import {MockedRabbitMQMessage} from "@tests/mocks/MockedRabbitMQMessage";

describe('RunMQFailureLoggerProducer Unit Tests', () => {
    const mockProducer = new MockedRabbitMQPublisher();
    const failureLoggerProducer: RunMQFailureLoggerProducer = new RunMQFailureLoggerProducer(
        mockProducer,
        MockedRunMQLogger
    );

    beforeEach(() => {
        jest.clearAllMocks();
        mockProducer.publish.mockResolvedValue(undefined);
    });

    describe('publish', () => {
        it('should delegate to wrapped producer when publish succeeds', async () => {
            const testTopic = 'test.topic';
            const testMessage = MockedRabbitMQMessage;

            await failureLoggerProducer.publish(testTopic, testMessage);

            expect(mockProducer.publish).toHaveBeenCalledWith(testTopic, testMessage);
            expect(MockedRunMQLogger.error).not.toHaveBeenCalled();
        });

        it('should log error and rethrow when publish rejects', async () => {
            const testTopic = 'test.topic';
            const testMessage = MockedRabbitMQMessage;

            const publishError = new Error('Publish failed');
            mockProducer.publish.mockRejectedValueOnce(publishError);

            await expect(failureLoggerProducer.publish(testTopic, testMessage))
                .rejects.toThrow('Publish failed');

            expect(mockProducer.publish).toHaveBeenCalledWith(testTopic, testMessage);
            expect(MockedRunMQLogger.error).toHaveBeenCalledWith(
                'Message publishing failed',
                expect.objectContaining({
                    topic: testTopic,
                    correlationId: testMessage.correlationId,
                    error: 'Publish failed',
                    stack: publishError.stack,
                })
            );
        });

        it('should handle non-Error rejections', async () => {
            const testTopic = 'test.topic';
            const testMessage = MockedRabbitMQMessage;

            mockProducer.publish.mockRejectedValueOnce('String error');

            await expect(failureLoggerProducer.publish(testTopic, testMessage))
                .rejects.toBe('String error');

            expect(MockedRunMQLogger.error).toHaveBeenCalledWith(
                'Message publishing failed',
                expect.objectContaining({
                    topic: testTopic,
                    correlationId: testMessage.correlationId,
                    error: JSON.stringify('String error'),
                    stack: undefined,
                })
            );
        });

        it('should preserve original error when rethrowing', async () => {
            const testTopic = 'test.topic';
            const testMessage = MockedRabbitMQMessage;

            const originalError = new Error('Original error');
            originalError.name = 'CustomError';
            mockProducer.publish.mockRejectedValueOnce(originalError);

            await expect(failureLoggerProducer.publish(testTopic, testMessage))
                .rejects.toBe(originalError);

            expect(MockedRunMQLogger.error).toHaveBeenCalledWith(
                'Message publishing failed',
                expect.objectContaining({
                    topic: testTopic,
                    correlationId: testMessage.correlationId,
                    error: 'Original error',
                    stack: originalError.stack,
                })
            );
        });
    });
});
