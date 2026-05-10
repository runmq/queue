import {RunMQConsumer} from "@src/types";
import {RabbitMQMessage} from "@src/core/message/RabbitMQMessage";
import {RunMQLogger} from "@src/core/logging/RunMQLogger";

export class RunMQSucceededMessageAcknowledgerProcessor implements RunMQConsumer {
    constructor(private consumer: RunMQConsumer, private logger?: RunMQLogger) {
    }

    public async consume(message: RabbitMQMessage) {
        const result = await this.consumer.consume(message);
        if (result) {
            const acked = message.ack();
            if (!acked) {
                this.logger?.warn('Failed to ack message — channel likely closed. Broker will redeliver.', {
                    correlationId: message.correlationId,
                });
            }
        }
        return result;
    }
}
