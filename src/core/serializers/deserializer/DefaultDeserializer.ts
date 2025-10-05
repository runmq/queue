import {Deserializer} from "@src/core/serializers/deserializer/Deserializer";
import {RunMQMessage, RunMQMessageMeta} from "@src/core/message/RunMQMessage";
import {RunMQProcessorConfiguration} from "@src/types";
import {getValidator} from "@src/core/serializers/deserializer/validation/ValidatorFactory";

export class DeserializationError extends Error {
    constructor(message: string, public readonly cause?: unknown) {
        super(message);
        this.name = 'DeserializationError';
    }
}

export class RunMQSchemaValidationError extends Error {
    constructor(message: string, public readonly error?: string) {
        super(message);
        this.name = 'ValidationError';
    }
}

export class DefaultDeserializer<T> implements Deserializer<RunMQMessage<T>> {
    deserialize(data: string, processorConfig: RunMQProcessorConfiguration): RunMQMessage<T> {
        if (!data) {
            throw new DeserializationError('Input must be a non-empty string');
        }

        let parsed: unknown;
        try {
            parsed = JSON.parse(data);
        } catch (error) {
            throw new DeserializationError(
                `Failed to parse JSON: ${error instanceof Error ? error.message : 'Unknown error'}`,
                error
            );
        }

        if (!RunMQMessage.isValid(parsed)) {
            throw new RunMQSchemaValidationError(
                'Invalid message format: not valid RunMQMessage structure'
            );
        }

        const typedParsed = parsed as { message: unknown; meta: { id: string; publishedAt: number } };

        if (processorConfig.messageSchema) {
            const {type, schema} = processorConfig.messageSchema;
            const validator = getValidator<T>(type);

            if (!validator.validate(schema, typedParsed.message)) {
                throw new RunMQSchemaValidationError(
                    'Message validation failed against schema',
                    validator.getError() || undefined
                );
            }
        }

        const message = typedParsed.message as T;

        return new RunMQMessage<T>(
            message,
            new RunMQMessageMeta(typedParsed.meta.id, typedParsed.meta.publishedAt)
        );
    }
}