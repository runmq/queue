import {RunMQConsumer} from "@src/types";
import {RabbitMQMessage} from "@src/core/message/RabbitMQMessage";
import {RunMQLogger} from "@src/core/logging/RunMQLogger";

export class RunMQFailedMessageRejecterProcessor implements RunMQConsumer {
    constructor(private consumer: RunMQConsumer, private logger?: RunMQLogger) {
    }

    public async consume(message: RabbitMQMessage): Promise<boolean> {
        try {
            return await this.consumer.consume(message);
        } catch {
            const nacked = message.nack(false);
            if (!nacked) {
                this.logger?.warn('Failed to nack message — channel likely closed. Broker will redeliver.', {
                    correlationId: message.correlationId,
                });
            }
            return false;
        }
    }
}
