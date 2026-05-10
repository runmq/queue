import {RunMQSchemaFailureProcessor} from "@src/core/consumer/processors/RunMQSchemaFailureProcessor";
import {RunMQSchemaValidationError, DeserializationError} from "@src/core/serializers/deserializer/DefaultDeserializer";
import {RunMQConsumer, RunMQProcessorConfiguration} from "@src/types";
import {RabbitMQMessage} from "@src/core/message/RabbitMQMessage";
import {MockedRunMQLogger} from "@tests/mocks/MockedRunMQLogger";
import {MockedRabbitMQPublisher} from "@tests/mocks/MockedRunMQPublisher";
import {MockedAMQPChannel} from "@tests/mocks/MockedAMQPChannel";
import {MockedAmqpMessage} from "@tests/mocks/MockedAmqpMessage";
import {RunMQMessage, RunMQMessageMeta} from "@src/core/message/RunMQMessage";
import {ConsumerCreatorUtils} from "@src/core/consumer/ConsumerCreatorUtils";

class MockedConsumer implements RunMQConsumer {
    constructor(private readonly behavior: 'success' | Error) {}

    consume(): Promise<boolean> {
        if (this.behavior === 'success') return Promise.resolve(true);
        return Promise.reject(this.behavior);
    }
}

describe('RunMQSchemaFailureProcessor', () => {
    const configWithDLQStrategy: RunMQProcessorConfiguration = {
        name: 'test-processor',
        consumersCount: 1,
        attempts: 3,
        attemptsDelay: 100,
        messageSchema: {
            type: 'ajv',
            schema: {type: 'object'},
            failureStrategy: 'dlq',
        },
    };

    const configWithoutSchema: RunMQProcessorConfiguration = {
        name: 'test-processor',
        consumersCount: 1,
    };

    const buildMessage = (payload: any) => new RabbitMQMessage(
        payload,
        'msg-id',
        'corr-id',
        new MockedAMQPChannel(),
        MockedAmqpMessage,
        {},
    );

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('passes through successful consume calls unchanged', async () => {
        const inner = new MockedConsumer('success');
        const publisher = new MockedRabbitMQPublisher();
        const processor = new RunMQSchemaFailureProcessor(inner, configWithDLQStrategy, publisher, MockedRunMQLogger);

        const result = await processor.consume(buildMessage('payload'));

        expect(result).toBe(true);
        expect(publisher.publish).not.toHaveBeenCalled();
    });

    it('routes message directly to DLQ when schema validation fails and strategy is "dlq"', async () => {
        const validationError = new RunMQSchemaValidationError('schema invalid', 'details');
        const inner = new MockedConsumer(validationError);
        const publisher = new MockedRabbitMQPublisher();
        const processor = new RunMQSchemaFailureProcessor(inner, configWithDLQStrategy, publisher, MockedRunMQLogger);

        const originalPayload = {bad: 'data'};
        const wrappedMessage = JSON.stringify(new RunMQMessage(
            originalPayload,
            new RunMQMessageMeta('msg-id', Date.now(), 'corr-id'),
        ));

        const result = await processor.consume(buildMessage(wrappedMessage));

        // Returns true so the outer chain acks the original message.
        expect(result).toBe(true);
        // Published once, to the right DLQ topic, with the unwrapped payload.
        expect(publisher.publish).toHaveBeenCalledTimes(1);
        const [topic, dlqMessage] = publisher.publish.mock.calls[0];
        expect(topic).toBe(ConsumerCreatorUtils.getDLQTopicName(configWithDLQStrategy.name));
        expect((dlqMessage as RabbitMQMessage).message).toEqual(originalPayload);
        // Warn log fires.
        expect(MockedRunMQLogger.warn).toHaveBeenCalledWith(
            expect.stringContaining('Schema validation failed'),
            expect.objectContaining({correlationId: 'corr-id', error: 'details'}),
        );
    });

    it('rethrows handler errors (non-schema) for the outer chain to handle', async () => {
        const handlerError = new Error('handler failed');
        const inner = new MockedConsumer(handlerError);
        const publisher = new MockedRabbitMQPublisher();
        const processor = new RunMQSchemaFailureProcessor(inner, configWithDLQStrategy, publisher, MockedRunMQLogger);

        await expect(processor.consume(buildMessage('payload'))).rejects.toBe(handlerError);
        expect(publisher.publish).not.toHaveBeenCalled();
    });

    it('rethrows JSON parse / deserialization errors (not schema errors)', async () => {
        const parseError = new DeserializationError('invalid json');
        const inner = new MockedConsumer(parseError);
        const publisher = new MockedRabbitMQPublisher();
        const processor = new RunMQSchemaFailureProcessor(inner, configWithDLQStrategy, publisher, MockedRunMQLogger);

        await expect(processor.consume(buildMessage('payload'))).rejects.toBe(parseError);
        expect(publisher.publish).not.toHaveBeenCalled();
    });

    it('rethrows schema validation errors when no schema is configured', async () => {
        const validationError = new RunMQSchemaValidationError('schema invalid');
        const inner = new MockedConsumer(validationError);
        const publisher = new MockedRabbitMQPublisher();
        const processor = new RunMQSchemaFailureProcessor(inner, configWithoutSchema, publisher, MockedRunMQLogger);

        await expect(processor.consume(buildMessage('payload'))).rejects.toBe(validationError);
        expect(publisher.publish).not.toHaveBeenCalled();
    });

    it('keeps payload as-is when message content is not a wrapped RunMQMessage', async () => {
        const validationError = new RunMQSchemaValidationError('schema invalid');
        const inner = new MockedConsumer(validationError);
        const publisher = new MockedRabbitMQPublisher();
        const processor = new RunMQSchemaFailureProcessor(inner, configWithDLQStrategy, publisher, MockedRunMQLogger);

        await processor.consume(buildMessage('plain text not json'));

        const [, dlqMessage] = publisher.publish.mock.calls[0];
        expect((dlqMessage as RabbitMQMessage).message).toBe('plain text not json');
    });
});
