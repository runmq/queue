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

    describe('publish', () => {
        it('should delegate to wrapped producer when publish succeeds', () => {
            const testTopic = 'test.topic';
            const testMessage = MockedRabbitMQMessage;

            failureLoggerProducer.publish(testTopic, testMessage);

            expect(mockProducer.publish).toHaveBeenCalledWith(testTopic, testMessage);
            expect(MockedRunMQLogger.error).not.toHaveBeenCalled();
        });

        it('should log error and rethrow when publish fails', () => {
            const testTopic = 'test.topic';
            const testMessage = MockedRabbitMQMessage;

            const publishError = new Error('Publish failed');

            mockProducer.publish.mockImplementation(() => {
                throw publishError;
            });

            expect(() => {
                failureLoggerProducer.publish(testTopic, testMessage);
            }).toThrow('Publish failed');

            expect(mockProducer.publish).toHaveBeenCalledWith(testTopic, testMessage);
            expect(MockedRunMQLogger.error).toHaveBeenCalledWith(
                'Message publishing failed',
                {
                    message: testMessage,
                    error: 'Publish failed',
                    stack: publishError.stack,
                }
            );
        });

        it('should handle non-Error exceptions', () => {
            const testTopic = 'test.topic';
            const testMessage = MockedRabbitMQMessage;

            const publishError = 'String error';

            mockProducer.publish.mockImplementation(() => {
                throw publishError;
            });

            expect(() => {
                failureLoggerProducer.publish(testTopic, testMessage);
            }).toThrow('String error');

            expect(MockedRunMQLogger.error).toHaveBeenCalledWith(
                'Message publishing failed',
                {
                    message: testMessage,
                    error: JSON.stringify(publishError),
                    stack: undefined,
                }
            );
        });

        it('should handle complex message objects in error logging', () => {
            const testTopic = 'test.topic';
            const testMessage = MockedRabbitMQMessage;

            const publishError = new Error('Complex message error');

            mockProducer.publish.mockImplementation(() => {
                throw publishError;
            });

            expect(() => {
                failureLoggerProducer.publish(testTopic, testMessage);
            }).toThrow('Complex message error');

            expect(MockedRunMQLogger.error).toHaveBeenCalledWith(
                'Message publishing failed',
                {
                    message: testMessage,
                    error: 'Complex message error',
                    stack: publishError.stack,
                }
            );
        });

        it('should handle null/undefined message content in error logging', () => {
            const testTopic = 'test.topic';
            const testMessage = MockedRabbitMQMessage;

            const publishError = new Error('Null message error');

            mockProducer.publish.mockImplementation(() => {
                throw publishError;
            });

            expect(() => {
                failureLoggerProducer.publish(testTopic, testMessage);
            }).toThrow('Null message error');

            expect(MockedRunMQLogger.error).toHaveBeenCalledWith(
                'Message publishing failed',
                {
                    message: testMessage,
                    error: 'Null message error',
                    stack: publishError.stack,
                }
            );
        });

        it('should preserve original error when rethrowing', () => {
            const testTopic = 'test.topic';
            const testMessage = MockedRabbitMQMessage;

            const originalError = new Error('Original error');
            originalError.name = 'CustomError';

            mockProducer.publish.mockImplementation(() => {
                throw originalError;
            });

            expect(() => {
                failureLoggerProducer.publish(testTopic, testMessage);
            }).toThrow(originalError);

            expect(MockedRunMQLogger.error).toHaveBeenCalledWith(
                'Message publishing failed',
                {
                    message: testMessage,
                    error: 'Original error',
                    stack: originalError.stack,
                }
            );
        });
    });
});
