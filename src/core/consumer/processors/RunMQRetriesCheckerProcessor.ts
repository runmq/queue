import {RunMQConsumer, RunMQProcessorConfiguration, RunMQPublisher} from "@src/types";
import {RabbitMQMessage} from "@src/core/message/RabbitMQMessage";
import {RunMQLogger} from "@src/core/logging/RunMQLogger";
import {ConsumerCreatorUtils} from "@src/core/consumer/ConsumerCreatorUtils";

export class RunMQRetriesCheckerProcessor implements RunMQConsumer {
    private readonly maxRetryCount: number = this.config.maxRetries ?? 1;

    constructor(
        private readonly consumer: RunMQConsumer,
        private readonly config: RunMQProcessorConfiguration,
        private readonly DLQPublisher: RunMQPublisher,
        private readonly logger: RunMQLogger,
    ) {
    }

    public async consume(message: RabbitMQMessage): Promise<boolean> {
        try {
            return await this.consumer.consume(message);
        } catch (e: unknown) {
            if (this.hasReachedMaxRetries(message)) {
                this.logMaxRetriesReached(message);
                this.moveToFinalDeadLetter(message);
                this.acknowledgeMessage(message);
                return false;
            }
            throw e;
        }
    }

    private hasReachedMaxRetries(message: RabbitMQMessage): boolean {
        const rejectedCount = this.getRejectionCount(message);
        return rejectedCount >= this.maxRetryCount;
    }

    private logMaxRetriesReached(message: RabbitMQMessage) {
        this.logger.error(
            `Message reached maximum retries. Moving to dead-letter queue.`, {
                message: JSON.stringify(message.message),
                retries: this.getRejectionCount(message),
                max: this.maxRetryCount,
            }
        );
    }

    private moveToFinalDeadLetter(message: RabbitMQMessage) {
        this.DLQPublisher.publish(ConsumerCreatorUtils.getDLQTopicName(this.config.name), message)
    }

    private acknowledgeMessage(message: RabbitMQMessage) {
        try {
            message.channel.ack(message.amqpMessage!, false);
        } catch (e) {
            const error = new Error("A message acknowledge failed after publishing to final dead letter");
            this.logger.error(error.message, {cause: e instanceof Error ? e.message : String(e)});
            throw error;
        }
    }

    private getRejectionCount(message: RabbitMQMessage): number {
        const xDeath = message.headers?.["x-death"];
        if (!Array.isArray(xDeath)) return 0;
        const deathRecord = xDeath.filter(entry => entry && entry.reason == 'rejected')[0];
        return deathRecord ? deathRecord.count + 1 : 0;
    }
}