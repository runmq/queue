import {RunMQProcessorConfiguration} from "@src/types";

export interface Serializer<T, K> {
    serialize(data: K): string;

    deserialize(data: string, processorConfig: RunMQProcessorConfiguration<T>): K;
}