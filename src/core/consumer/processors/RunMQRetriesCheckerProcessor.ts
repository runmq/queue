import {RunMQConsumer, RunMQProcessorConfiguration} from "@src/types";
import {RabbitMQMessage} from "@src/core/message/RabbitMQMessage";
import {RunMQLogger} from "@src/core/logging/RunMQLogger";
import {ConsumerCreatorUtils} from "@src/core/consumer/ConsumerCreatorUtils";
import {Constants, DEFAULTS} from "@src/core/constants";

export class RunMQRetriesCheckerProcessor implements RunMQConsumer {
    private readonly maxAttempts: number = this.config.attempts ?? DEFAULTS.PROCESSING_ATTEMPTS;

    constructor(
        private readonly consumer: RunMQConsumer,
        private readonly config: RunMQProcessorConfiguration,
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
        return rejectedCount >= this.maxAttempts;
    }

    private logMaxRetriesReached(message: RabbitMQMessage) {
        this.logger.error(
            `Message reached maximum attempts. Moving to dead-letter queue.`, {
                message: message.message,
                attempts: this.getRejectionCount(message),
                max: this.maxAttempts,
            }
        );
    }

    // Republish the original AMQP body verbatim so the envelope (including
    // publishedAt) is preserved end-to-end for audit/replay.
    private moveToFinalDeadLetter(message: RabbitMQMessage) {
        if (!message.amqpMessage) return;
        message.channel.publish(
            Constants.DEAD_LETTER_ROUTER_EXCHANGE_NAME,
            ConsumerCreatorUtils.getDLQTopicName(this.config.name),
            message.amqpMessage.content,
            {
                correlationId: message.correlationId,
                messageId: message.id,
                headers: message.headers,
                persistent: true,
            }
        );
    }

    private acknowledgeMessage(message: RabbitMQMessage) {
        try {
            message.ack();
        } catch (e) {
            const error = new Error("A message acknowledge failed after publishing to final dead letter");
            this.logger.error(error.message, {cause: e instanceof Error ? e.message : String(e)});
            throw error;
        }
    }

    private getRejectionCount(message: RabbitMQMessage): number {
        const xDeath = message.headers?.["x-death"];
        if (!Array.isArray(xDeath)) return 1;
        const deathRecord = xDeath.filter(entry => entry && entry.reason == 'rejected')[0];
        return deathRecord ? deathRecord.count + 1 : 1;
    }
}
