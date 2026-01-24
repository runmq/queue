import {ConsumerConfiguration} from '@src/core/consumer/ConsumerConfiguration';
import {Constants, DEFAULTS} from '@src/core/constants';
import {MockedAMQPChannel} from "@tests/mocks/MockedAMQPChannel";
import {RunMQProcessorConfigurationExample} from "@tests/Examples/RunMQProcessorConfigurationExample";
import {ConsumerConfigurationExample} from "@tests/Examples/ConsumerConfigurationExample";
import {RunMQConsumerCreator} from "@src/core/consumer/RunMQConsumerCreator";
import {MockedRunMQLogger} from "@tests/mocks/MockedRunMQLogger";
import {MockedAMQPClient} from "@tests/mocks/MockedAMQPClient";
import {RunMQTTLPolicyManager} from "@src/core/management/Policies/RunMQTTLPolicyManager";
import {RunMQException} from "@src/core/exceptions/RunMQException";

jest.mock('@src/core/management/Policies/RunMQTTLPolicyManager');

describe('RunMQConsumerCreator Unit Tests', () => {
    const mockedChannel = new MockedAMQPChannel();
    const mockedClient = new MockedAMQPClient(mockedChannel);
    const mockTTLPolicyManager = {
        initialize: jest.fn(),
        apply: jest.fn()
    };

    const testProcessorConfig = RunMQProcessorConfigurationExample.random(
        'testProcessor',
        3,
        2,
        5000
    );
    const testProcessorConfigWithPolicies = RunMQProcessorConfigurationExample.random(
        'testProcessor',
        3,
        2,
        5000,
        undefined,
        true
    );
    const testConsumerConfigWithPolicies = ConsumerConfigurationExample.withProcessorConfig(testProcessorConfigWithPolicies)

    const testConsumerConfig = ConsumerConfigurationExample.withProcessorConfig(testProcessorConfig)
    let consumerCreator: RunMQConsumerCreator;

    beforeEach(() => {
        jest.clearAllMocks();
        jest.mocked(RunMQTTLPolicyManager).mockImplementation(() => mockTTLPolicyManager as any);
        mockTTLPolicyManager.initialize.mockResolvedValue(undefined);
        mockTTLPolicyManager.apply.mockResolvedValue(true);
        consumerCreator = new RunMQConsumerCreator(mockedClient, MockedRunMQLogger, undefined);
    });

    describe('createConsumer', () => {
        it('should create consumer with correct queue assertions when usePoliciesForDelay is false', async () => {
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
                    messageTtl: testProcessorConfig.attemptsDelay
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

            expect(mockTTLPolicyManager.apply).not.toHaveBeenCalled();
        });

        it('should use TTL policies when usePoliciesForDelay is true', async () => {

            await consumerCreator.createConsumer(testConsumerConfigWithPolicies);

            expect(mockTTLPolicyManager.apply).toHaveBeenCalledWith(
                Constants.RETRY_DELAY_QUEUE_PREFIX + testProcessorConfig.name,
                testProcessorConfig.attemptsDelay
            );

            expect(mockedChannel.assertQueue).toHaveBeenCalledWith(
                Constants.RETRY_DELAY_QUEUE_PREFIX + testProcessorConfig.name,
                {
                    durable: true,
                    deadLetterExchange: Constants.ROUTER_EXCHANGE_NAME
                }
            );
        });

        it('should throw exception when TTL policy application fails', async () => {
            mockTTLPolicyManager.apply.mockResolvedValue(false);

            await expect(consumerCreator.createConsumer(testConsumerConfigWithPolicies))
                .rejects.toThrow(RunMQException);
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

            expect(mockedChannel.prefetch).toHaveBeenCalledWith(DEFAULTS.PREFETCH_COUNT);
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