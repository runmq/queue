import {RunMQConsumer} from "@src/types";
import {RunMQExceptionLoggerProcessor} from "@src/core/consumer/processors/RunMQExceptionLoggerProcessor";
import {RabbitMQMessage} from "@src/core/message/RabbitMQMessage";
import {MockedRunMQLogger} from "@tests/mocks/MockedRunMQLogger";

describe('RunMQExceptionLoggerProcessor Unit tests', () => {
    const rabbitMQMessage = {} as unknown as jest.Mocked<RabbitMQMessage>;

    it('should log error and rethrow when consumer throws an error', async () => {
        const mockConsumer: jest.Mocked<RunMQConsumer> = {
            consume: jest.fn().mockImplementationOnce(() => {
                throw new Error("Test error");
            }),
        };
        const runMQExceptionLoggerProcessor = new RunMQExceptionLoggerProcessor(mockConsumer, MockedRunMQLogger);

        await expect(runMQExceptionLoggerProcessor.consume(rabbitMQMessage)).rejects.toThrow("Test error");
    });

    it('should log error and rethrow when consumer throws an error but not instance of Error', async () => {
        const mockConsumer: jest.Mocked<RunMQConsumer> = {
            consume: jest.fn().mockImplementationOnce(() => {
                throw new RuntimeError("Test error");
            }),
        };
        const runMQExceptionLoggerProcessor = new RunMQExceptionLoggerProcessor(mockConsumer, MockedRunMQLogger);

        await expect(runMQExceptionLoggerProcessor.consume(rabbitMQMessage)).rejects.toThrow("Test error");
    });
})

class RuntimeError {
    constructor(public message: string) {
    }
}