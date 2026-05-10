import {RunMQFailureLoggerProcessor} from "@src/core/consumer/processors/RunMQFailureLoggerProcessor";
import {MockedThrowableRabbitMQConsumer} from "@tests/mocks/MockedRunMQConsumer";
import {MockedRunMQLogger} from "@tests/mocks/MockedRunMQLogger";
import {MockedRabbitMQMessage} from "@tests/mocks/MockedRabbitMQMessage";

describe('RunMQFailureLoggerProcessor', () => {
    const mockedRunMQConsumer = new MockedThrowableRabbitMQConsumer()

    it("should log error with correlationId/messageId (and not the payload) by default", async () => {
        const processor = new RunMQFailureLoggerProcessor(mockedRunMQConsumer, MockedRunMQLogger);
        await expect(processor.consume(MockedRabbitMQMessage)).rejects.toThrow("Mocked error");

        expect(MockedRunMQLogger.error).toHaveBeenCalledWith('Message processing failed', {
                correlationId: MockedRabbitMQMessage.correlationId,
                messageId: MockedRabbitMQMessage.id,
            },
            expect.any(String));
    });

    it("should include the payload when logFullMessagePayload is true", async () => {
        const processor = new RunMQFailureLoggerProcessor(mockedRunMQConsumer, MockedRunMQLogger, true);
        await expect(processor.consume(MockedRabbitMQMessage)).rejects.toThrow("Mocked error");

        expect(MockedRunMQLogger.error).toHaveBeenCalledWith('Message processing failed', {
                correlationId: MockedRabbitMQMessage.correlationId,
                messageId: MockedRabbitMQMessage.id,
                message: MockedRabbitMQMessage.message,
            },
            expect.any(String));
    });
})