import {ConsumerConfiguration} from '@src/core/consumer/ConsumerConfiguration';
import {Constants} from '@src/core/constants';
import {MockedRabbitMQChannel} from "@tests/mocks/MockedRabbitMQChannel";
import {RunMQProcessorConfigurationExample} from "@tests/Examples/RunMQProcessorConfigurationExample";
import {ConsumerConfigurationExample} from "@tests/Examples/ConsumerConfigurationExample";
import {RunMQConsumerCreator} from "@src/core/consumer/RunMQConsumerCreator";
import {MockedRunMQLogger} from "@tests/mocks/MockedRunMQLogger";
import {MockedAMQPClient} from "@tests/mocks/MockedAMQPClient";

describe('RunMQConsumerCreator Unit Tests', () => {
    const mockedChannel = new MockedRabbitMQChannel();
    const mockedClient = new MockedAMQPClient(mockedChannel);

    const testProcessorConfig = RunMQProcessorConfigurationExample.random(
        'testProcessor',
        3,
        2,
        5000
    );
    const testConsumerConfig = ConsumerConfigurationExample.withProcessorConfig(testProcessorConfig)
    const consumerCreator = new RunMQConsumerCreator(mockedChannel, mockedClient, MockedRunMQLogger)

    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('createConsumer', () => {
        it('should create consumer with correct queue assertions', async () => {
            await consumerCreator.createConsumer(testConsumerConfig);

            expect(mockedChannel.assertQueue).toHaveBeenCalledWith(
                testProcessorConfig.name,
                {
                    durable: true,
                    deadLetterExchange: Constants.DEAD_LETTER_ROUTER_EXCHANGE_NAME,
                    deadLetterRoutingKey: testProcessorConfig.name
                }
            );

            expect(mockedChannel.assertQueue).toHaveBeenCalledWith(
                Constants.RETRY_DELAY_QUEUE_PREFIX + testProcessorConfig.name,
                {
                    durable: true,
                    deadLetterExchange: Constants.ROUTER_EXCHANGE_NAME,
                    messageTtl: testProcessorConfig.retryDelay
                }
            );

            expect(mockedChannel.assertQueue).toHaveBeenCalledWith(
                Constants.DLQ_QUEUE_PREFIX + testProcessorConfig.name,
                {
                    durable: true,
                    deadLetterExchange: Constants.ROUTER_EXCHANGE_NAME,
                    deadLetterRoutingKey: testProcessorConfig.name
                }
            );
        });

        it('should bind queues correctly', async () => {
            await consumerCreator.createConsumer(testConsumerConfig);

            expect(mockedChannel.bindQueue).toHaveBeenCalledWith(
                testProcessorConfig.name,
                Constants.ROUTER_EXCHANGE_NAME,
                testConsumerConfig.topic
            );

            expect(mockedChannel.bindQueue).toHaveBeenCalledWith(
                testProcessorConfig.name,
                Constants.ROUTER_EXCHANGE_NAME,
                testProcessorConfig.name
            );

            expect(mockedChannel.bindQueue).toHaveBeenCalledWith(
                Constants.RETRY_DELAY_QUEUE_PREFIX + testProcessorConfig.name,
                Constants.DEAD_LETTER_ROUTER_EXCHANGE_NAME,
                testProcessorConfig.name
            );

            expect(mockedChannel.bindQueue).toHaveBeenCalledWith(
                Constants.DLQ_QUEUE_PREFIX + testProcessorConfig.name,
                Constants.DEAD_LETTER_ROUTER_EXCHANGE_NAME,
                Constants.DLQ_QUEUE_PREFIX + testProcessorConfig.name
            );
        });

        it('should create multiple consumers based on consumersCount', async () => {
            await consumerCreator.createConsumer(testConsumerConfig);

            expect(mockedClient.getChannel).toHaveBeenCalledTimes(testProcessorConfig.consumersCount);
            expect(mockedChannel.prefetch).toHaveBeenCalledTimes(testProcessorConfig.consumersCount);
            expect(mockedChannel.consume).toHaveBeenCalledTimes(testProcessorConfig.consumersCount);
        });

        it('should set prefetch and consume on consumer channels', async () => {
            await consumerCreator.createConsumer(testConsumerConfig);

            expect(mockedChannel.prefetch).toHaveBeenCalledWith(10);
            expect(mockedChannel.consume).toHaveBeenCalledWith(
                testProcessorConfig.name,
                expect.any(Function)
            );
        });

        describe('queue naming', () => {
            it('should use correct queue names with prefixes', async () => {
                const customConfig = new ConsumerConfiguration(
                    'custom.topic',
                    {
                        ...testProcessorConfig,
                        name: 'customProcessor'
                    },
                    jest.fn()
                );

                await consumerCreator.createConsumer(customConfig);

                expect(mockedChannel.assertQueue).toHaveBeenCalledWith(
                    'customProcessor',
                    expect.any(Object)
                );
                expect(mockedChannel.assertQueue).toHaveBeenCalledWith(
                    Constants.RETRY_DELAY_QUEUE_PREFIX + 'customProcessor',
                    expect.any(Object)
                );
                expect(mockedChannel.assertQueue).toHaveBeenCalledWith(
                    Constants.DLQ_QUEUE_PREFIX + 'customProcessor',
                    expect.any(Object)
                );
            });
        });
    });
});