import {RunMQConsumer, RunMQProcessorConfiguration} from "@src/types";
import {RunMQMessage} from "@src/core/message/RunMQMessage";
import {RabbitMQMessage} from "@src/core/message/RabbitMQMessage";
import {DefaultDeserializer} from "@src/core/serializers/deserializer/DefaultDeserializer";

export class RunMQBaseProcessor<T> implements RunMQConsumer {
    constructor(private handler: (message: RunMQMessage<T>) => Promise<void>,
                private processorConfig: RunMQProcessorConfiguration,
                private serializer: DefaultDeserializer<T>
    ) {
    }

    public async consume(message: RabbitMQMessage): Promise<boolean> {
        const rabbitMQMessage = this.serializer.deserialize(message.message, this.processorConfig);
        await this.handler(rabbitMQMessage as RunMQMessage<T>);
        return true;
    }
}