import {RunMQConsumerCreator} from '@src/core/consumer/RunMQConsumerCreator';
import {ConsumerConfiguration} from '@src/core/consumer/ConsumerConfiguration';
import {AmqplibClient} from '@src/core/clients/AmqplibClient';
import {RunMQLogger} from '@src/core/logging/RunMQLogger';
import {Constants} from '@src/core/constants';
import {Channel} from 'amqplib';
import {RunMQProcessorConfiguration} from '@src/types';

jest.mock('@src/core/clients/AmqplibClient');
jest.mock('@src/core/consumer/processors/RunMQExceptionLoggerProcessor');
jest.mock('@src/core/consumer/processors/RunMQSucceededMessageAcknowledgerProcessor');
jest.mock('@src/core/consumer/processors/RunMQFailedMessageRejecterProcessor');
jest.mock('@src/core/consumer/processors/RunMQRetriesCheckerProcessor');
jest.mock('@src/core/consumer/processors/RunMQFailureLoggerProcessor');
jest.mock('@src/core/consumer/processors/RunMQBaseProcessor');

describe('RunMQConsumerCreator Unit Tests', () => {
    let mockDefaultChannel: Partial<Channel>;
    let mockConsumerChannel: Partial<Channel>;
    let mockClient: jest.Mocked<AmqplibClient>;
    let mockLogger: jest.Mocked<RunMQLogger>;
    let consumerCreator: RunMQConsumerCreator;

    const testProcessorConfig: RunMQProcessorConfiguration = {
        name: 'testProcessor',
        maxRetries: 3,
        consumersCount: 2,
        retryDelay: 5000,
    };

    const testConsumerConfig = new ConsumerConfiguration(
        'test.topic',
        testProcessorConfig,
        jest.fn()
    );

    beforeEach(() => {
        jest.clearAllMocks();

        mockDefaultChannel = {
            assertQueue: jest.fn().mockResolvedValue(undefined),
            bindQueue: jest.fn().mockResolvedValue(undefined),
            assertExchange: jest.fn().mockResolvedValue(undefined)
        };

        mockConsumerChannel = {
            prefetch: jest.fn().mockResolvedValue(undefined),
            consume: jest.fn().mockResolvedValue(undefined)
        };

        mockClient = {
            getChannel: jest.fn().mockResolvedValue(mockConsumerChannel)
        } as any;

        mockLogger = {
            log: jest.fn(),
            error: jest.fn()
        } as any;

        consumerCreator = new RunMQConsumerCreator(
            mockDefaultChannel as Channel,
            mockClient,
            mockLogger
        );
    });

    describe('createConsumer', () => {
        it('should create consumer with correct queue assertions', async () => {
            await consumerCreator.createConsumer(testConsumerConfig);

            expect(mockDefaultChannel.assertQueue).toHaveBeenCalledWith(
                testProcessorConfig.name,
                {
                    durable: true,
                    deadLetterExchange: Constants.DEAD_LETTER_ROUTER_EXCHANGE_NAME,
                    deadLetterRoutingKey: testProcessorConfig.name
                }
            );

            expect(mockDefaultChannel.assertQueue).toHaveBeenCalledWith(
                Constants.RETRY_DELAY_QUEUE_PREFIX + testProcessorConfig.name,
                {
                    durable: true,
                    deadLetterExchange: Constants.ROUTER_EXCHANGE_NAME,
                    messageTtl: testProcessorConfig.retryDelay
                }
            );

            expect(mockDefaultChannel.assertQueue).toHaveBeenCalledWith(
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

            expect(mockDefaultChannel.bindQueue).toHaveBeenCalledWith(
                testProcessorConfig.name,
                Constants.ROUTER_EXCHANGE_NAME,
                testConsumerConfig.topic
            );

            expect(mockDefaultChannel.bindQueue).toHaveBeenCalledWith(
                testProcessorConfig.name,
                Constants.ROUTER_EXCHANGE_NAME,
                testProcessorConfig.name
            );

            expect(mockDefaultChannel.bindQueue).toHaveBeenCalledWith(
                Constants.RETRY_DELAY_QUEUE_PREFIX + testProcessorConfig.name,
                Constants.DEAD_LETTER_ROUTER_EXCHANGE_NAME,
                testProcessorConfig.name
            );

            expect(mockDefaultChannel.bindQueue).toHaveBeenCalledWith(
                Constants.DLQ_QUEUE_PREFIX + testProcessorConfig.name,
                Constants.DEAD_LETTER_ROUTER_EXCHANGE_NAME,
                Constants.DLQ_QUEUE_PREFIX + testProcessorConfig.name
            );
        });

        it('should create multiple consumers based on consumersCount', async () => {
            await consumerCreator.createConsumer(testConsumerConfig);

            expect(mockClient.getChannel).toHaveBeenCalledTimes(testProcessorConfig.consumersCount);
            expect(mockConsumerChannel.prefetch).toHaveBeenCalledTimes(testProcessorConfig.consumersCount);
            expect(mockConsumerChannel.consume).toHaveBeenCalledTimes(testProcessorConfig.consumersCount);
        });

        it('should set prefetch and consume on consumer channels', async () => {
            await consumerCreator.createConsumer(testConsumerConfig);

            expect(mockConsumerChannel.prefetch).toHaveBeenCalledWith(10);
            expect(mockConsumerChannel.consume).toHaveBeenCalledWith(
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

                expect(mockDefaultChannel.assertQueue).toHaveBeenCalledWith(
                    'customProcessor',
                    expect.any(Object)
                );
                expect(mockDefaultChannel.assertQueue).toHaveBeenCalledWith(
                    Constants.RETRY_DELAY_QUEUE_PREFIX + 'customProcessor',
                    expect.any(Object)
                );
                expect(mockDefaultChannel.assertQueue).toHaveBeenCalledWith(
                    Constants.DLQ_QUEUE_PREFIX + 'customProcessor',
                    expect.any(Object)
                );
            });
        });
    });
});