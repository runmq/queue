import {RunMQProcessorConfiguration} from "@src/types";
import {RunMQMessage} from "@src/core/message/RunMQMessage";
import {faker} from "@faker-js/faker";
import {RunMQProcessorConfigurationExample} from "@tests/Examples/RunMQProcessorConfigurationExample";

export class ConsumerConfiguration<T> {
    constructor(
        readonly topic: string,
        readonly processorConfig: RunMQProcessorConfiguration,
        readonly processor: (message: RunMQMessage<T>) => Promise<void>) {
    }
}

export class ConsumerConfigurationExample {
    static random(
        topic = faker.lorem.word(),
        processorConfig = RunMQProcessorConfigurationExample.simpleNoSchema(),
        processor = jest.fn(),
    ) {
        return new ConsumerConfiguration<any>(
            topic,
            processorConfig,
            processor
        )
    }

    static withProcessorConfig(processorConfig: RunMQProcessorConfiguration) {
        return this.random(faker.lorem.word(), processorConfig);
    }
}