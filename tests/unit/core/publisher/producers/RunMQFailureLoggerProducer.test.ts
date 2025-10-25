import {RunMQFailureLoggerProducer} from '@src/core/publisher/producers/RunMQFailureLoggerProducer';
import {RunMQPublisher} from '@src/types';
import {RunMQLogger} from '@src/core/logging/RunMQLogger';

describe('RunMQFailureLoggerProducer Unit Tests', () => {
    let mockProducer: jest.Mocked<RunMQPublisher>;
    let mockLogger: jest.Mocked<RunMQLogger>;
    let failureLoggerProducer: RunMQFailureLoggerProducer;

    beforeEach(() => {
        jest.clearAllMocks();

        mockProducer = {
            publish: jest.fn()
        };

        mockLogger = {
            info: jest.fn(),
            warn: jest.fn(),
            error: jest.fn(),
            debug: jest.fn(),
            log: jest.fn(),
            verbose: jest.fn(),
        };

        failureLoggerProducer = new RunMQFailureLoggerProducer(mockProducer, mockLogger);
    });

    describe('publish', () => {
        it('should delegate to wrapped producer when publish succeeds', () => {
            const testTopic = 'test.topic';
            const testMessage = { name: 'Test Message', value: 42 };

            failureLoggerProducer.publish(testTopic, testMessage);

            expect(mockProducer.publish).toHaveBeenCalledWith(testTopic, testMessage);
            expect(mockLogger.error).not.toHaveBeenCalled();
        });

        it('should log error and rethrow when publish fails', () => {
            const testTopic = 'test.topic';
            const testMessage = { name: 'Test Message', value: 42 };
            const publishError = new Error('Publish failed');

            mockProducer.publish.mockImplementation(() => {
                throw publishError;
            });

            expect(() => {
                failureLoggerProducer.publish(testTopic, testMessage);
            }).toThrow('Publish failed');

            expect(mockProducer.publish).toHaveBeenCalledWith(testTopic, testMessage);
            expect(mockLogger.error).toHaveBeenCalledWith(
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
            const testMessage = { name: 'Test Message' };
            const publishError = 'String error';

            mockProducer.publish.mockImplementation(() => {
                throw publishError;
            });

            expect(() => {
                failureLoggerProducer.publish(testTopic, testMessage);
            }).toThrow('String error');

            expect(mockLogger.error).toHaveBeenCalledWith(
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
            const testMessage = {
                message: {
                    content: Buffer.from('test content')
                },
                meta: { id: 'test-id' }
            };
            const publishError = new Error('Complex message error');

            mockProducer.publish.mockImplementation(() => {
                throw publishError;
            });

            expect(() => {
                failureLoggerProducer.publish(testTopic, testMessage);
            }).toThrow('Complex message error');

            expect(mockLogger.error).toHaveBeenCalledWith(
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
            const testMessage = { name: 'Test Message' };
            const publishError = new Error('Null message error');

            mockProducer.publish.mockImplementation(() => {
                throw publishError;
            });

            expect(() => {
                failureLoggerProducer.publish(testTopic, testMessage);
            }).toThrow('Null message error');

            expect(mockLogger.error).toHaveBeenCalledWith(
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
            const testMessage = { name: 'Test Message' };
            const originalError = new Error('Original error');
            originalError.name = 'CustomError';

            mockProducer.publish.mockImplementation(() => {
                throw originalError;
            });

            expect(() => {
                failureLoggerProducer.publish(testTopic, testMessage);
            }).toThrow(originalError);

            expect(mockLogger.error).toHaveBeenCalledWith(
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
