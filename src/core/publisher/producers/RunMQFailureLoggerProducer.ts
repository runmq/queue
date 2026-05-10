import {RunMQPublisher} from "@src/types";
import {RunMQLogger} from "@src/core/logging/RunMQLogger";
import {RabbitMQMessage} from "@src/core/message/RabbitMQMessage";

export class RunMQFailureLoggerProducer implements RunMQPublisher {
    constructor(private producer: RunMQPublisher, private logger: RunMQLogger) {
    }

    async publish(topic: string, message: RabbitMQMessage): Promise<void> {
        try {
            await this.producer.publish(topic, message);
        } catch (e) {
            this.logger.error('Message publishing failed', {
                topic,
                correlationId: message.correlationId,
                error: e instanceof Error ? e.message : JSON.stringify(e),
                stack: e instanceof Error ? e.stack : undefined,
            });
            throw e;
        }
    }
}