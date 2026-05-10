import {ConsumerConfiguration} from "@src/core/consumer/ConsumerConfiguration";
import {Constants, DEFAULTS} from "@src/core/constants";
import {RabbitMQMessage} from "@src/core/message/RabbitMQMessage";
import {
    RunMQSucceededMessageAcknowledgerProcessor
} from "@src/core/consumer/processors/RunMQSucceededMessageAcknowledgerProcessor";
import {RunMQFailedMessageRejecterProcessor} from "@src/core/consumer/processors/RunMQFailedMessageRejecterProcessor";
import {RunMQRetriesCheckerProcessor} from "@src/core/consumer/processors/RunMQRetriesCheckerProcessor";
import {RunMQFailureLoggerProcessor} from "@src/core/consumer/processors/RunMQFailureLoggerProcessor";
import {RunMQSchemaFailureProcessor} from "@src/core/consumer/processors/RunMQSchemaFailureProcessor";
import {RunMQBaseProcessor} from "@src/core/consumer/processors/RunMQBaseProcessor";
import {RunMQExceptionLoggerProcessor} from "@src/core/consumer/processors/RunMQExceptionLoggerProcessor";
import {RunMQLogger} from "@src/core/logging/RunMQLogger";
import {DefaultDeserializer} from "@src/core/serializers/deserializer/DefaultDeserializer";
import {ConsumerCreatorUtils} from "@src/core/consumer/ConsumerCreatorUtils";
import {RunMQPublisherCreator} from "@src/core/publisher/RunMQPublisherCreator";
import {AMQPClient, RabbitMQManagementConfig} from "@src/types";
import {RunMQTTLPolicyManager} from "@src/core/management/Policies/RunMQTTLPolicyManager";
import {RunMQMetadataManager} from "@src/core/management/Policies/RunMQMetadataManager";
import {RunMQException} from "@src/core/exceptions/RunMQException";
import {Exceptions} from "@src/core/exceptions/Exceptions";

export class RunMQConsumerCreator {
    private ttlPolicyManager: RunMQTTLPolicyManager;
    private metadataManager: RunMQMetadataManager;

    constructor(
        private client: AMQPClient,
        private logger: RunMQLogger,
        managementConfig?: RabbitMQManagementConfig,
        private logFullMessagePayload: boolean = false,
    ) {
        this.ttlPolicyManager = new RunMQTTLPolicyManager(logger, managementConfig);
        this.metadataManager = new RunMQMetadataManager(logger, managementConfig);
    }

    public async createConsumer<T>(consumerConfiguration: ConsumerConfiguration<T>) {
        await this.ttlPolicyManager.initialize();
        await this.metadataManager.initialize();
        await this.assertQueues<T>(consumerConfiguration);
        await this.bindQueues<T>(consumerConfiguration);
        await this.storeMetadata<T>(consumerConfiguration);
        for (let i = 0; i < consumerConfiguration.processorConfig.consumersCount; i++) {
            await this.runProcessor<T>(consumerConfiguration);
        }
    }

    private async storeMetadata<T>(consumerConfiguration: ConsumerConfiguration<T>): Promise<void> {
        const maxRetries = consumerConfiguration.processorConfig.attempts ?? DEFAULTS.PROCESSING_ATTEMPTS;

        await this.metadataManager.apply(
            consumerConfiguration.processorConfig.name,
            maxRetries
        );
    }

    private async runProcessor<T>(consumerConfiguration: ConsumerConfiguration<T>): Promise<void> {
        const consumerChannel = await this.client.getChannel({
            onClose: () => {
                if (!this.client.isActive()) {
                    return;
                }
                this.logger.warn('Consumer channel closed; attempting to re-subscribe', {
                    processor: consumerConfiguration.processorConfig.name,
                });
                this.resubscribeProcessor(consumerConfiguration);
            },
        });
        const DLQPublisher = new RunMQPublisherCreator(this.logger).createPublisher(Constants.DEAD_LETTER_ROUTER_EXCHANGE_NAME);

        // Always enable publisher confirms on the consumer channel: DLQ
        // publishes flow through this channel and we cannot tolerate silent
        // drops there (issue #19).
        await consumerChannel.confirmSelect();

        const prefetchCount = consumerConfiguration.processorConfig.prefetch ?? DEFAULTS.PREFETCH_COUNT;
        await consumerChannel.prefetch(prefetchCount);
        await consumerChannel.consume(consumerConfiguration.processorConfig.name, async (msg) => {
            if (!msg) return;
            const rabbitmqMessage = new RabbitMQMessage(
                msg.content.toString(),
                msg.properties.messageId,
                msg.properties.correlationId,
                consumerChannel,
                msg,
                msg.properties.headers,
            )
            try {
                await new RunMQExceptionLoggerProcessor(
                    new RunMQSucceededMessageAcknowledgerProcessor(
                        new RunMQFailedMessageRejecterProcessor(
                            new RunMQRetriesCheckerProcessor(
                                new RunMQFailureLoggerProcessor(
                                    new RunMQSchemaFailureProcessor(
                                        new RunMQBaseProcessor<T>(
                                            consumerConfiguration.processor,
                                            consumerConfiguration.processorConfig,
                                            new DefaultDeserializer<T>()
                                        ),
                                        consumerConfiguration.processorConfig,
                                        DLQPublisher,
                                        this.logger
                                    ),
                                    this.logger,
                                    this.logFullMessagePayload,
                                ),
                                consumerConfiguration.processorConfig,
                                this.logger,
                                this.logFullMessagePayload,
                            ),
                            this.logger
                        ),
                        this.logger
                    ), this.logger).consume(rabbitmqMessage)
            } catch (e) {
                // Last-resort guard: nothing above should throw, but if it does
                // we must not let the rejection propagate into amqplib's
                // consume callback (would become an unhandled rejection and
                // can crash the worker on Node 15+).
                this.logger.error('Unhandled error in consumer chain', {
                    correlationId: rabbitmqMessage.correlationId,
                    cause: e instanceof Error ? e.message : String(e),
                    stack: e instanceof Error ? e.stack : undefined,
                });
            }
        });
    }


    private async assertQueues<T>(consumerConfiguration: ConsumerConfiguration<T>) {
        const defaultChannel = await this.client.getDefaultChannel();

        await defaultChannel.assertQueue(consumerConfiguration.processorConfig.name, {
            durable: true,
            deadLetterExchange: Constants.DEAD_LETTER_ROUTER_EXCHANGE_NAME,
            deadLetterRoutingKey: consumerConfiguration.processorConfig.name
        });
        await defaultChannel.assertQueue(ConsumerCreatorUtils.getDLQTopicName(consumerConfiguration.processorConfig.name), {
            durable: true,
            deadLetterExchange: Constants.ROUTER_EXCHANGE_NAME,
            deadLetterRoutingKey: consumerConfiguration.processorConfig.name
        });

        const retryDelayQueueName = ConsumerCreatorUtils.getRetryDelayTopicName(consumerConfiguration.processorConfig.name);
        const messageDelay = consumerConfiguration.processorConfig.attemptsDelay ?? DEFAULTS.PROCESSING_RETRY_DELAY


        const policiesForTTL = consumerConfiguration.processorConfig.usePoliciesForDelay ?? false;
        if (!policiesForTTL) {
            await defaultChannel.assertQueue(retryDelayQueueName, {
                durable: true,
                deadLetterExchange: Constants.ROUTER_EXCHANGE_NAME,
                messageTtl: messageDelay,
            });
            return;
        }

        const result = await this.ttlPolicyManager.apply(
            retryDelayQueueName,
            messageDelay
        );
        if (result) {
            await defaultChannel.assertQueue(retryDelayQueueName, {
                durable: true,
                deadLetterExchange: Constants.ROUTER_EXCHANGE_NAME
            });
            return;
        }
        throw new RunMQException(
            Exceptions.FAILURE_TO_DEFINE_TTL_POLICY,
            {
                error: "Failed to apply TTL policy to queue: " + retryDelayQueueName
            }
        );
    }


    private async bindQueues<T>(consumerConfiguration: ConsumerConfiguration<T>) {
        const defaultChannel = await this.client.getDefaultChannel();

        await defaultChannel.bindQueue(
            consumerConfiguration.processorConfig.name,
            Constants.ROUTER_EXCHANGE_NAME,
            consumerConfiguration.topic
        );
        await defaultChannel.bindQueue(
            consumerConfiguration.processorConfig.name,
            Constants.ROUTER_EXCHANGE_NAME,
            consumerConfiguration.processorConfig.name
        );
        await defaultChannel.bindQueue(
            ConsumerCreatorUtils.getRetryDelayTopicName(consumerConfiguration.processorConfig.name),
            Constants.DEAD_LETTER_ROUTER_EXCHANGE_NAME,
            consumerConfiguration.processorConfig.name
        );
        await defaultChannel.bindQueue(
            ConsumerCreatorUtils.getDLQTopicName(consumerConfiguration.processorConfig.name),
            Constants.DEAD_LETTER_ROUTER_EXCHANGE_NAME,
            ConsumerCreatorUtils.getDLQTopicName(consumerConfiguration.processorConfig.name)
        );
    }

    private resubscribeProcessor<T>(consumerConfiguration: ConsumerConfiguration<T>): void {
        const delay = DEFAULTS.RECONNECT_DELAY;
        setTimeout(() => {
            if (!this.client.isActive()) {
                return;
            }
            this.runProcessor(consumerConfiguration).catch((err) => {
                this.logger.error('Failed to re-subscribe consumer; will retry', {
                    processor: consumerConfiguration.processorConfig.name,
                    error: err instanceof Error ? err.message : err,
                });
                this.resubscribeProcessor(consumerConfiguration);
            });
        }, delay);
    }
}