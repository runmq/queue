import {RunMQProcessorConfiguration} from "@src/types";

export interface Deserializer<K> {
    deserialize(data: string, processorConfig: RunMQProcessorConfiguration): K;
}