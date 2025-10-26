import {RunMQFailureLoggerProcessor} from "@src/core/consumer/processors/RunMQFailureLoggerProcessor";
import {MockedThrowableRabbitMQConsumer} from "@tests/mocks/MockedRunMQConsumer";
import {MockedRunMQLogger} from "@tests/mocks/MockedRunMQLogger";
import {MockedRabbitMQMessage} from "@tests/mocks/MockedRabbitMQMessage";

describe('RunMQFailureLoggerProcessor', () => {
    const mockedRunMQConsumer = new MockedThrowableRabbitMQConsumer()

    it("should log error and rethrow when consumer throws", async () => {
        const processor = new RunMQFailureLoggerProcessor(mockedRunMQConsumer, MockedRunMQLogger);
        await expect(processor.consume(MockedRabbitMQMessage)).rejects.toThrow("Mocked error");

        expect(MockedRunMQLogger.error).toHaveBeenCalledWith('Message processing failed', {
            message: MockedRabbitMQMessage.message,
            error: "Mocked error",
            stack: expect.any(String),
        });
    });
})