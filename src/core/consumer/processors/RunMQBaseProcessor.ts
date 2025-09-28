import {RunMQConsumer} from "@src/types";
import {RunMQMessage} from "@src/core/message/RunMQMessage";
import {RabbitMQMessage} from "@src/core/message/RabbitMQMessage";
import {DefaultSerializer} from "@src/core/serializers/DefaultSerializer";

export class RunMQBaseProcessor<T> implements RunMQConsumer {
    constructor(private handler: (message: RunMQMessage<T>) => void,
                private serializer: DefaultSerializer<T>
    ) {
    }

    public consume(message: RabbitMQMessage): boolean {
        const raw = JSON.parse(message.message.content.toString());
        const rabbitMQMessage = this.serializer.deserialize(raw);
        this.handler(rabbitMQMessage as RunMQMessage<T>);
        return true;
    }
}