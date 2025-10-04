import {RunMQLogger} from "@src/core/logging/RunMQLogger";
import {RunMQRetriesCheckerProcessor} from "@src/core/consumer/processors/RunMQRetriesCheckerProcessor";
import {RunMQProcessorConfiguration} from "@src/types";
import {RabbitMQMessage} from "@src/core/message/RabbitMQMessage";
import {Constants} from "@src/core/constants";

describe('RunMQRetriesCheckerProcessor', () => {
    const consumer = {
        consume: jest.fn().mockImplementation(() => {
            throw new Error("Test error");
        }),
    }
    const logger = {
        error: jest.fn()
    } as unknown as RunMQLogger;

    const processorConfig: RunMQProcessorConfiguration = {
        name: "test-processor",
        consumersCount: 1,
        maxRetries: 3,
        retryDelay: 5000,
    };

    beforeEach(() => {
        jest.clearAllMocks();
    })


    it("should throw error if message hasn't reached max retries yet", () => {
        const message = {
            message: {
                properties: {
                    headers: {
                        "x-death": [
                            {count: 1, "reason": "rejected"},
                        ]
                    }
                }
            }
        } as unknown as jest.Mocked<RabbitMQMessage>

        const processor = new RunMQRetriesCheckerProcessor(consumer, processorConfig, logger)
        try {
            processor.consume(message)
        } catch (e) {
            expect(e).toBeInstanceOf(Error);
        }
    })

    it('should log and move to dead-letter queue when max retries reached and acknowledge message', () => {
        const message = {
            message: {
                properties: {
                    headers: {
                        "x-death": [
                            {count: 2, "reason": "rejected"},
                        ]
                    }
                }
            },
            channel: {
                ack: jest.fn(),
                publish: jest.fn(),
            }
        } as unknown as jest.Mocked<RabbitMQMessage>

        const processor = new RunMQRetriesCheckerProcessor(consumer, processorConfig, logger)
        processor.consume(message)

        expect(logger.error).toHaveBeenCalledWith(`Message reached maximum retries. Moving to dead-letter queue.`, {
            message: message.message.content?.toString(),
            retries: 3,
            max: 3,
        });
        expect(message.channel.publish).toHaveBeenCalledWith(
            Constants.DEAD_LETTER_ROUTER_EXCHANGE_NAME, Constants.DLQ_QUEUE_PREFIX + processorConfig.name,
            message.message.content,
            {
                headers: message.message.properties.headers
            }
        )
        expect(message.channel.ack).toHaveBeenCalledWith(message.message, false);
    })
})

describe('RunMQRetriesCheckerProcessor - acknowledgeMessage', () => {
    const consumer = {
        consume: jest.fn().mockImplementationOnce(() => {
            throw new Error("Test error");
        }),
    }
    const logger = {
        error: jest.fn()
    } as unknown as RunMQLogger;

    const processorConfig: RunMQProcessorConfiguration = {
        name: "test-processor",
        consumersCount: 1,
        maxRetries: 3,
        retryDelay: 5000,
    };

    it("should throw error if acknowledge message failed", () => {
        const message = {
            message: {
                properties: {
                    headers: {
                        "x-death": [
                            {count: 2, "reason": "rejected"},
                        ]
                    }
                }
            },
            channel: {
                ack: jest.fn().mockImplementationOnce(() => {
                    throw new Error("acknowledge error");
                }),
                publish: jest.fn(),
            }
        } as unknown as jest.Mocked<RabbitMQMessage>

        const processor = new RunMQRetriesCheckerProcessor(consumer, processorConfig, logger)
        try {
            processor.consume(message)

        } catch (e) {
            expect(e).toBeInstanceOf(Error);
            expect((e as Error).message).toBe("A message acknowledge failed after publishing to final dead letter");
            expect((e as any).cause).toBeInstanceOf(Error);
            expect((e as any).cause.message).toBe("acknowledge error");
        }

        expect(logger.error).toHaveBeenCalledWith(`Message reached maximum retries. Moving to dead-letter queue.`, {
            message: message.message.content?.toString(),
            retries: 3,
            max: 3,
        });
        expect(message.channel.publish).toHaveBeenCalledWith(
            Constants.DEAD_LETTER_ROUTER_EXCHANGE_NAME, Constants.DLQ_QUEUE_PREFIX + processorConfig.name,
            message.message.content,
            {
                headers: message.message.properties.headers
            }
        )
    });

});