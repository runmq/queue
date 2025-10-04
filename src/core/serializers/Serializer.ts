import {RunMQProcessorConfiguration} from "@src/types";

export interface Serializer<K> {
    serialize(data: K): string;

    deserialize(data: string, processorConfig: RunMQProcessorConfiguration): K;
}