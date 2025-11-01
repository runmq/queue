import {Channel} from "amqplib";
import {ConsumerConfiguration} from "@src/core/consumer/ConsumerConfiguration";
import {Constants} from "@src/core/constants";
import {RabbitMQMessage} from "@src/core/message/RabbitMQMessage";
import {
    RunMQSucceededMessageAcknowledgerProcessor
} from "@src/core/consumer/processors/RunMQSucceededMessageAcknowledgerProcessor";
import {RunMQFailedMessageRejecterProcessor} from "@src/core/consumer/processors/RunMQFailedMessageRejecterProcessor";
import {RunMQRetriesCheckerProcessor} from "@src/core/consumer/processors/RunMQRetriesCheckerProcessor";
import {RunMQFailureLoggerProcessor} from "@src/core/consumer/processors/RunMQFailureLoggerProcessor";
import {RunMQBaseProcessor} from "@src/core/consumer/processors/RunMQBaseProcessor";
import {RunMQExceptionLoggerProcessor} from "@src/core/consumer/processors/RunMQExceptionLoggerProcessor";
import {RunMQLogger} from "@src/core/logging/RunMQLogger";
import {DefaultDeserializer} from "@src/core/serializers/deserializer/DefaultDeserializer";
import {ConsumerCreatorUtils} from "@src/core/consumer/ConsumerCreatorUtils";
import {RunMQPublisherCreator} from "@src/core/publisher/RunMQPublisherCreator";
import {AMQPClient} from "@src/types";

export class RunMQConsumerCreator {
    constructor(
        private defaultChannel: Channel,
        private client: AMQPClient,
        private logger: RunMQLogger,
    ) {
    }


    public async createConsumer<T>(consumerConfiguration: ConsumerConfiguration<T>) {
        await this.assertQueues<T>(consumerConfiguration);
        await this.bindQueues<T>(consumerConfiguration);
        for (let i = 0; i < consumerConfiguration.processorConfig.consumersCount; i++) {
            await this.runProcessor<T>(consumerConfiguration);
        }
    }


    private async runProcessor<T>(consumerConfiguration: ConsumerConfiguration<T>): Promise<void> {
        const consumerChannel = await this.getProcessorChannel();
        const DLQPublisher = new RunMQPublisherCreator(this.logger).createPublisher(Constants.DEAD_LETTER_ROUTER_EXCHANGE_NAME);

        await consumerChannel.prefetch(10);
        await consumerChannel.consume(consumerConfiguration.processorConfig.name, async (msg) => {
            if (msg) {
                const rabbitmqMessage = new RabbitMQMessage(
                    msg.content.toString(),
                    msg.properties.messageId,
                    msg.properties.correlationId,
                    consumerChannel,
                    msg,
                    msg.properties.headers,
                )
                return new RunMQExceptionLoggerProcessor(
                    new RunMQSucceededMessageAcknowledgerProcessor(
                        new RunMQFailedMessageRejecterProcessor(
                            new RunMQRetriesCheckerProcessor(
                                new RunMQFailureLoggerProcessor(
                                    new RunMQBaseProcessor<T>(
                                        consumerConfiguration.processor,
                                        consumerConfiguration.processorConfig,
                                        new DefaultDeserializer<T>()
                                    ),
                                    this.logger
                                ),
                                consumerConfiguration.processorConfig,
                                DLQPublisher,
                                this.logger
                            )
                        )
                    ), this.logger).consume(rabbitmqMessage)
            }
        });
    }


    private async assertQueues<T>(consumerConfiguration: ConsumerConfiguration<T>) {
        await this.defaultChannel.assertQueue(consumerConfiguration.processorConfig.name, {
            durable: true,
            deadLetterExchange: Constants.DEAD_LETTER_ROUTER_EXCHANGE_NAME,
            deadLetterRoutingKey: consumerConfiguration.processorConfig.name
        });
        await this.defaultChannel.assertQueue(ConsumerCreatorUtils.getRetryDelayTopicName(consumerConfiguration.processorConfig.name), {
            durable: true,
            deadLetterExchange: Constants.ROUTER_EXCHANGE_NAME,
            messageTtl: consumerConfiguration.processorConfig.retryDelay
        });
        await this.defaultChannel.assertQueue(ConsumerCreatorUtils.getDLQTopicName(consumerConfiguration.processorConfig.name), {
            durable: true,
            deadLetterExchange: Constants.ROUTER_EXCHANGE_NAME,
            deadLetterRoutingKey: consumerConfiguration.processorConfig.name
        });
    }


    private async bindQueues<T>(consumerConfiguration: ConsumerConfiguration<T>) {
        await this.defaultChannel.bindQueue(
            consumerConfiguration.processorConfig.name,
            Constants.ROUTER_EXCHANGE_NAME,
            consumerConfiguration.topic
        );
        await this.defaultChannel.bindQueue(
            consumerConfiguration.processorConfig.name,
            Constants.ROUTER_EXCHANGE_NAME,
            consumerConfiguration.processorConfig.name
        );
        await this.defaultChannel.bindQueue(
            ConsumerCreatorUtils.getRetryDelayTopicName(consumerConfiguration.processorConfig.name),
            Constants.DEAD_LETTER_ROUTER_EXCHANGE_NAME,
            consumerConfiguration.processorConfig.name
        );
        await this.defaultChannel.bindQueue(
            ConsumerCreatorUtils.getDLQTopicName(consumerConfiguration.processorConfig.name),
            Constants.DEAD_LETTER_ROUTER_EXCHANGE_NAME,
            ConsumerCreatorUtils.getDLQTopicName(consumerConfiguration.processorConfig.name)
        );
    }

    private async getProcessorChannel(): Promise<Channel> {
        return await this.client.getChannel()
    }
}