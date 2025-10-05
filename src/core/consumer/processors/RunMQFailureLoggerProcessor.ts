import {RunMQConsumer} from "@src/types";
import {RabbitMQMessage} from "@src/core/message/RabbitMQMessage";
import {RunMQLogger} from "@src/core/logging/RunMQLogger";

export class RunMQFailureLoggerProcessor implements RunMQConsumer {
    constructor(private consumer: RunMQConsumer, private logger: RunMQLogger) {
    }

    public async consume(message: RabbitMQMessage) {
        try {
            return await this.consumer.consume(message);
        } catch (e) {
            this.logger.error('Message processing failed', {
                message: message.message.content.toString(),
                error: e instanceof Error ? e.message : JSON.stringify(e),
                stack: e instanceof Error ? e.stack : undefined,
            });
            throw e;
        }
    }
}