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
        private readonly logFullMessagePayload: boolean = false,
    ) {
    }

    public async consume(message: RabbitMQMessage): Promise<boolean> {
        try {
            return await this.consumer.consume(message);
        } catch (e: unknown) {
            if (this.hasReachedMaxRetries(message)) {
                this.logMaxRetriesReached(message);
                try {
                    await this.moveToFinalDeadLetter(message);
                } catch (publishError) {
                    // DLQ publish failed (broker rejected, channel closed, etc.).
                    // Do NOT ack — that would lose the message. nack(false)
                    // sends it back through the retry pipeline, where it'll
                    // come right back here on the next attempt with a natural
                    // backoff (the retry-delay-queue TTL). If the underlying
                    // failure is transient, the next attempt's DLQ publish
                    // will succeed.
                    this.logger.error('Failed to publish to DLQ — message will be redelivered', {
                        correlationId: message.correlationId,
                        cause: publishError instanceof Error ? publishError.message : String(publishError),
                    });
                    message.nack(false);
                    return false;
                }
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
                correlationId: message.correlationId,
                messageId: message.id,
                attempts: this.getRejectionCount(message),
                max: this.maxAttempts,
                ...(this.logFullMessagePayload ? {message: message.message} : {}),
            }
        );
    }

    // Republish the original AMQP body verbatim so the envelope (including
    // publishedAt) is preserved end-to-end for audit/replay. The consumer
    // channel runs in confirm mode (see RunMQConsumerCreator), so awaiting
    // this publish surfaces broker-side rejections instead of dropping them.
    private async moveToFinalDeadLetter(message: RabbitMQMessage): Promise<void> {
        if (!message.amqpMessage) return;
        await message.channel.publish(
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
        const acked = message.ack();
        if (!acked) {
            this.logger.warn('Failed to ack message after publishing to final dead letter — channel likely closed. Broker will redeliver.', {
                correlationId: message.correlationId,
            });
        }
    }

    private getRejectionCount(message: RabbitMQMessage): number {
        const xDeath = message.headers?.["x-death"];
        if (!Array.isArray(xDeath)) return 1;
        const deathRecord = xDeath.filter(entry => entry && entry.reason == 'rejected')[0];
        return deathRecord ? deathRecord.count + 1 : 1;
    }
}
