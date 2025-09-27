import {RunMQConsumer, RunMQProcessorConfiguration} from "@src/types";
import {RabbitMQMessage} from "@src/core/message/RabbitMQMessage";
import {RunMQLogger} from "@src/core/logging/RunMQLogger";
import {Constants} from "@src/core/constants";

export class RunMQRetriesCheckerProcessor<T> implements RunMQConsumer {
    private readonly maxRetryCount: number = this.config.maxRetries ?? 1;

    constructor(
        private readonly consumer: RunMQConsumer,
        private readonly config: RunMQProcessorConfiguration<T>,
        private readonly logger: RunMQLogger,
    ) {
    }

    public consume(message: RabbitMQMessage): boolean {
        try {
            return this.consumer.consume(message);
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
                message: message.message.content?.toString(),
                retries: this.getRejectionCount(message),
                max: this.maxRetryCount,
            }
        );
    }

    private moveToFinalDeadLetter(message: RabbitMQMessage) {
        message.channel.publish(Constants.DEAD_LETTER_ROUTER_EXCHANGE_NAME,
            Constants.DLQ_QUEUE_PREFIX + this.config.name,
            message.message.content,
            {
                headers: message.message.properties.headers
            })
    }

    private acknowledgeMessage(message: RabbitMQMessage) {
        try {
            message.channel.ack(message.message, false);
        } catch (e) {
            const error = new Error("A message acknowledge failed after publishing to final dead letter");
            (error as any).cause = e;
            throw error;
        }
    }

    private getRejectionCount(message: RabbitMQMessage): number {
        const xDeath = message.message.properties.headers?.["x-death"];
        if (!Array.isArray(xDeath)) return 0;
        const deathRecord = xDeath.filter(entry => entry && entry.reason == 'rejected')[0];
        return deathRecord ? deathRecord.count + 1 : 0;
    }
}