import {Serializer} from "@src/core/serializers/Serializer";
import {RunMQMessage} from "@src/core/message/RunMQMessage";

export class SerializationError extends Error {
    constructor(message: string, public readonly cause?: unknown) {
        super(message);
        this.name = 'SerializationError';
    }
}

export class DefaultSerializer implements Serializer {
    serialize(data: RunMQMessage) {
        try {
            return JSON.stringify(data);
        } catch (error) {
            throw new SerializationError(
                `Failed to serialize message: ${error instanceof Error ? error.message : 'Unknown error'}`,
                error
            );
        }
    }
}