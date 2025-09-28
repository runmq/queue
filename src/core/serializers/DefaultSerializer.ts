import {Serializer} from "@src/core/serializers/Serializer";
import {RunMQMessage, RunMQMessageMeta} from "@src/core/message/RunMQMessage";
import {plainToInstance} from "class-transformer";
import {RunMQProcessorConfiguration} from "@src/types";

export class DefaultSerializer<T> implements Serializer<T, RunMQMessage> {
    serialize(data: RunMQMessage): string {
        return JSON.stringify(data);
    }

    deserialize(data: string, processorConfig: RunMQProcessorConfiguration<T>): RunMQMessage {
        // todo: change for zod/ajv to validate the structure
        const content = plainToInstance(
            RunMQMessage,
            data,
            {
                targetMaps: processorConfig.cls ? [{
                    target: RunMQMessage,
                    properties: {message: processorConfig.cls}
                }] : []
            }
        ) as unknown as RunMQMessage<T>;

        if (!(content instanceof RunMQMessage) ||
            !(content.meta instanceof RunMQMessageMeta) ||
            (processorConfig.cls && !(content.message instanceof processorConfig.cls))
        ) {
            throw new Error('Message is not a valid RunMQMessage');
        }
        return content as RunMQMessage;
    }
}