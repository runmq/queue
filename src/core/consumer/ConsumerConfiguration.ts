import {RunMQProcessorConfiguration} from "@src/types";
import {RunMQMessage} from "@src/core/message/RunMQMessage";

export class ConsumerConfiguration<T> {
    constructor(
        readonly topic: string,
        readonly processorConfig: RunMQProcessorConfiguration,
        readonly processor: (message: RunMQMessage<T>) => Promise<void>) {
    }
}