import {RunMQConsumer, RunMQProcessorConfiguration, RunMQPublisher} from "@src/types";
import {RabbitMQMessage} from "@src/core/message/RabbitMQMessage";
import {RunMQLogger} from "@src/core/logging/RunMQLogger";
import {ConsumerCreatorUtils} from "@src/core/consumer/ConsumerCreatorUtils";
import {RunMQMessage} from "@src/core/message/RunMQMessage";
import {RunMQSchemaValidationError} from "@src/core/serializers/deserializer/DefaultDeserializer";

/**
 * Honors the configured `failureStrategy` for schema-validation failures.
 *
 * Without this processor, a schema-validation error takes the same path as
 * any handler error: it gets retried `attempts` times before reaching the
 * DLQ. That's wasteful — a malformed message will never become valid by
 * retrying it.
 *
 * When `messageSchema.failureStrategy === 'dlq'`, this processor catches
 * `RunMQSchemaValidationError` from the deserializer and routes the message
 * straight to the DLQ. The original message is then acked (we return true,
 * letting `RunMQSucceededMessageAcknowledgerProcessor` do the ack).
 *
 * Other errors (handler exceptions, JSON parse errors) propagate up the
 * chain unchanged.
 */
export class RunMQSchemaFailureProcessor implements RunMQConsumer {
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
            if (this.shouldRouteToDLQ(e)) {
                this.logger.warn('Schema validation failed — routing message to DLQ.', {
                    correlationId: message.correlationId,
                    error: e instanceof RunMQSchemaValidationError ? e.error : undefined,
                });
                this.routeToDLQ(message);
                return true;
            }
            throw e;
        }
    }

    private shouldRouteToDLQ(e: unknown): boolean {
        if (!(e instanceof RunMQSchemaValidationError)) return false;
        return this.config.messageSchema?.failureStrategy === 'dlq';
    }

    private routeToDLQ(message: RabbitMQMessage) {
        const dlqMessage = new RabbitMQMessage(
            this.extractOriginalPayload(message),
            message.id,
            message.correlationId,
            message.channel,
            message.amqpMessage,
            message.headers,
        );
        this.DLQPublisher.publish(
            ConsumerCreatorUtils.getDLQTopicName(this.config.name),
            dlqMessage,
        );
    }

    private extractOriginalPayload(message: RabbitMQMessage): any {
        if (typeof message.message === 'string') {
            try {
                const parsed = JSON.parse(message.message);
                if (RunMQMessage.isValid(parsed)) {
                    return parsed.message;
                }
            } catch {
                // Not valid JSON, use as-is
            }
        }
        return message.message;
    }
}
