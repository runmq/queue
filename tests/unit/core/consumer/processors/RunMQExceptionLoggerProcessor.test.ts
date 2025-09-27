import {RunMQLogger} from "@src/core/logging/RunMQLogger";
import {RunMQConsumer} from "@src/types";
import {RunMQExceptionLoggerProcessor} from "@src/core/consumer/processors/RunMQExceptionLoggerProcessor";
import {RabbitMQMessage} from "@src/core/message/RabbitMQMessage";

describe('RunMQExceptionLoggerProcessor Unit tests', () => {
    const mockLogger: jest.Mocked<RunMQLogger> = {
        log: jest.fn(),
        error: jest.fn(),
        warn: jest.fn(),
        info: jest.fn(),
        debug: jest.fn(),
        verbose: jest.fn(),
    };
    const rabbitMQMessage = {} as unknown as jest.Mocked<RabbitMQMessage>;

    it('should log error and rethrow when consumer throws an error', () => {
        const mockConsumer: jest.Mocked<RunMQConsumer> = {
            consume: jest.fn().mockImplementationOnce(() => {
                throw new Error("Test error");
            }),
        };
        const runMQExceptionLoggerProcessor = new RunMQExceptionLoggerProcessor(mockConsumer, mockLogger);
        try {
            runMQExceptionLoggerProcessor.consume(rabbitMQMessage);
        } catch (e) {
            expect(mockLogger.error).toHaveBeenCalledWith("Test error", (e as Error).stack);
            expect(e).toBeInstanceOf(Error);
            expect((e as Error).message).toBe("Test error");
        }
    });

    it('should log error and rethrow when consumer throws an error but not instance of Error', () => {
        const mockConsumer: jest.Mocked<RunMQConsumer> = {
            consume: jest.fn().mockImplementationOnce(() => {
                throw new RuntimeError("Test error");
            }),
        };
        const runMQExceptionLoggerProcessor = new RunMQExceptionLoggerProcessor(mockConsumer, mockLogger);
        try {
            runMQExceptionLoggerProcessor.consume(rabbitMQMessage);
        } catch (e) {
            const stringified = JSON.stringify(new RuntimeError("Test error"));
            expect(mockLogger.error).toHaveBeenCalledWith(stringified);
            expect(e).toBeInstanceOf(Error);
            expect((e as Error).message).toBe(stringified);
        }
    });
})

class RuntimeError {
    constructor(public message: string) {
    }
}