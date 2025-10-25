import {RunMQLogger} from "@src/core/logging/RunMQLogger";
import {RunMQFailureLoggerProcessor} from "@src/core/consumer/processors/RunMQFailureLoggerProcessor";
import {RabbitMQMessage} from "@src/core/message/RabbitMQMessage";

describe('RunMQFailureLoggerProcessor', () => {
    const consumer = {
        consume: jest.fn().mockImplementationOnce(() => {
            throw new Error('Test error')
        })
    }
    const logger = {
        error: jest.fn()
    } as unknown as jest.Mocked<RunMQLogger>;
    const message = {
        message: "test message",
    } as unknown as RabbitMQMessage;

    it("should log error and rethrow when consumer throws", async () => {
        const processor = new RunMQFailureLoggerProcessor(consumer, logger);
        try {
            await processor.consume(message);
        } catch (error) {
            expect(logger.error).toHaveBeenCalledWith('Message processing failed', {
                message: message.message,
                error: (error as Error).message,
                stack: (error as Error).stack,
            });
            expect(error).toBeInstanceOf(Error);
            expect((error as Error).message).toEqual("Test error")
        }
    });
})