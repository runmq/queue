import {RunMQConsumer, RunMQProcessorConfiguration} from "@src/types";
import {RunMQMessage, RunMQMessageMeta} from "@src/core/message/RunMQMessage";
import {plainToInstance} from "class-transformer";
import {RabbitMQMessage} from "@src/core/message/RabbitMQMessage";

export class RunMQBaseProcessor<T> implements RunMQConsumer {
    constructor(private handler: (message: RunMQMessage<T>) => void, private config: RunMQProcessorConfiguration<T>) {
    }

    public consume(message: RabbitMQMessage): boolean {
        const raw = JSON.parse(message.message.content.toString());
        const content = plainToInstance(
            RunMQMessage,
            raw,
            {
                targetMaps: this.config.cls ? [{target: RunMQMessage, properties: {message: this.config.cls}}] : []
            }
        ) as unknown as RunMQMessage<T>;

        if (!(content instanceof RunMQMessage) ||
            !(content.meta instanceof RunMQMessageMeta) ||
            (this.config.cls && !(content.message instanceof this.config.cls))
        ) {
            throw new Error('Message is not a valid RunMQMessage');
        }

        this.handler(content);
        return true;
    }
}