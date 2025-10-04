import {Serializer} from "@src/core/serializers/Serializer";
import {RunMQMessage, RunMQMessageMeta} from "@src/core/message/RunMQMessage";
import {RunMQProcessorConfiguration} from "@src/types";
import {getValidator} from "@src/core/serializers/validation/ValidatorFactory";
import {RunMQMessageValidationError} from "@src/core/serializers/validation/RunMQMessageValidationError";

export class SerializationError extends Error {
    constructor(message: string, public readonly cause?: unknown) {
        super(message);
        this.name = 'SerializationError';
    }
}

export class RunMQSchemaValidationError extends Error {
    constructor(message: string, public readonly errors?: RunMQMessageValidationError[]) {
        super(message);
        this.name = 'ValidationError';
    }
}

export class DefaultSerializer<T> implements Serializer<RunMQMessage<T>> {
    serialize(data: RunMQMessage<T>): string {
        try {
            return JSON.stringify(data);
        } catch (error) {
            throw new SerializationError(
                `Failed to serialize message: ${error instanceof Error ? error.message : 'Unknown error'}`,
                error
            );
        }
    }

    deserialize(data: string, processorConfig: RunMQProcessorConfiguration): RunMQMessage<T> {
        if (!data) {
            throw new SerializationError('Input must be a non-empty string');
        }

        let parsed: unknown;
        try {
            parsed = JSON.parse(data);
        } catch (error) {
            throw new SerializationError(
                `Failed to parse JSON: ${error instanceof Error ? error.message : 'Unknown error'}`,
                error
            );
        }

        if (!RunMQMessage.isValid(parsed)) {
            throw new RunMQSchemaValidationError(
                'Invalid message format: missing required fields or incorrect types'
            );
        }

        const typedParsed = parsed as { message: unknown; meta: { id: string; publishedAt: number } };

        if (processorConfig.messageSchema) {
            const {type, schema} = processorConfig.messageSchema;
            const validator = getValidator<T>(type);

            if (!validator.validate(schema, typedParsed.message)) {
                const errors = validator.getErrors();
                throw new RunMQSchemaValidationError(
                    'Message validation failed against schema',
                    errors || undefined
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