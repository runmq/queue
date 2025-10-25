import {RunMQLogger} from "@src/core/logging/RunMQLogger";
import {RunMQRetriesCheckerProcessor} from "@src/core/consumer/processors/RunMQRetriesCheckerProcessor";
import {RunMQProcessorConfiguration, RunMQPublisher} from "@src/types";
import {RabbitMQMessage} from "@src/core/message/RabbitMQMessage";
import {ConsumerCreatorUtils} from "@src/core/consumer/ConsumerCreatorUtils";

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


    it("should throw error if message hasn't reached max retries yet", async () => {
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
        const runMQPublisher = {
            publish: jest.fn(),
        } as unknown as jest.Mocked<RunMQPublisher>;

        const processor = new RunMQRetriesCheckerProcessor(consumer, processorConfig, runMQPublisher, logger)
        await expect(processor.consume(message)).rejects.toThrow(Error);
    })

    it('should log and move to dead-letter queue when max retries reached and acknowledge message', () => {
        const message = {
            message: "test message",
            headers: {
                "x-death": [
                    {count: 2, "reason": "rejected"},
                ]
            },
            channel: {
                ack: jest.fn(),
                publish: jest.fn(),
            }
        } as unknown as jest.Mocked<RabbitMQMessage>
        const runMQPublisher = {
            publish: jest.fn(),
        } as unknown as jest.Mocked<RunMQPublisher>;

        const processor = new RunMQRetriesCheckerProcessor(consumer, processorConfig, runMQPublisher, logger)
        processor.consume(message)

        expect(logger.error).toHaveBeenCalledWith(`Message reached maximum retries. Moving to dead-letter queue.`, {
            message: message.message,
            retries: 3,
            max: 3,
        });
        expect(runMQPublisher.publish).toHaveBeenCalledWith(
            ConsumerCreatorUtils.getDLQTopicName(processorConfig.name),
            message
        )
        expect(message.channel.ack).toHaveBeenCalledWith(message.amqpMessage, false);
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

    it("should throw error if acknowledge message failed", async () => {
        const message = {
            message: "test message",
            headers: {
                "x-death": [
                    {count: 2, "reason": "rejected"},
                ]
            },
            channel: {
                ack: jest.fn(),
                publish: jest.fn(),
            }
        } as unknown as jest.Mocked<RabbitMQMessage>

        const runMQPublisher = {
            publish: jest.fn(),
        } as unknown as jest.Mocked<RunMQPublisher>;

        const processor = new RunMQRetriesCheckerProcessor(consumer, processorConfig, runMQPublisher, logger)
        try {
            await processor.consume(message)
        } catch (e) {
            expect(e).toBeInstanceOf(Error);
            expect((e as Error).message).toBe("A message acknowledge failed after publishing to final dead letter");
            expect((e as any).cause).toBeInstanceOf(Error);
            expect((e as any).cause.message).toBe("acknowledge error");
        }

        expect(logger.error).toHaveBeenCalledWith(`Message reached maximum retries. Moving to dead-letter queue.`, {
            message: message.message,
            retries: 3,
            max: 3,
        });
        expect(runMQPublisher.publish).toHaveBeenCalledWith(
            ConsumerCreatorUtils.getDLQTopicName(processorConfig.name),
            message
        )
    });

});