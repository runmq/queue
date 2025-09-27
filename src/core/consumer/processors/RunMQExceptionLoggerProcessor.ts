import {RunMQConsumer} from "@src/types";
import {RabbitMQMessage} from "@src/core/message/RabbitMQMessage";
import {RunMQLogger} from "@src/core/logging/RunMQLogger";

export class RunMQExceptionLoggerProcessor implements RunMQConsumer {
    constructor(private consumer: RunMQConsumer, private logger: RunMQLogger) {}

    public consume(message: RabbitMQMessage) {
        try {
            return this.consumer.consume(message);
        } catch (e: unknown) {
            if (e instanceof Error) {
                this.logger.error(e.message, e.stack);
                throw e;
            } else {
                const stringified = JSON.stringify(e);
                this.logger.error(stringified);
                throw new Error(stringified);
            }
        }
    }
}