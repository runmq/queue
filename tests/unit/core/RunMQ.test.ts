import {RunMQ} from '@src/core/RunMQ';
import {AmqplibClient} from '@src/core/clients/AmqplibClient';
import {RunMQException} from '@src/core/exceptions/RunMQException';
import {Exceptions} from '@src/core/exceptions/Exceptions';
import {RunMQUtils} from '@src/core/utils/Utils';
import {RunMQConsumerCreator} from '@src/core/consumer/RunMQConsumerCreator';
import {Channel} from 'amqplib';
import {Constants} from '@src/core/constants';
import {RunMQConnectionConfigExample} from "@tests/Examples/RunMQConnectionConfigExample";
import {RunMQProcessorConfigurationExample} from "@tests/Examples/RunMQProcessorConfigurationExample";
import {MockedRabbitMQChannel} from "@tests/mocks/MockedRabbitMQChannel";
import {MessageExample} from "@tests/Examples/MessageExample";
import {MockedRunMQLogger} from "@tests/mocks/MockedRunMQLogger";
import {RunMQPublisherCreator} from "@src/core/publisher/RunMQPublisherCreator";

jest.mock('@src/core/clients/AmqplibClient');
jest.mock('@src/core/utils/Utils');
jest.mock('@src/core/consumer/RunMQConsumerCreator');
jest.mock('@src/core/publisher/RunMQPublisherCreator');

describe('RunMQ Unit Tests', () => {
    const mockChannel = new MockedRabbitMQChannel();
    const validConfig = RunMQConnectionConfigExample.valid();

    const setupSuccessfulAmqplibClientMock = () => {
        const mockAmqplibClient = AmqplibClient as jest.MockedClass<typeof AmqplibClient>;
        mockAmqplibClient.prototype.connect.mockResolvedValue({} as any);
        mockAmqplibClient.prototype.getChannel.mockResolvedValue(mockChannel as Channel);
        return mockAmqplibClient;
    };

    const setupFailingAmqplibClientMock = (error: Error) => {
        const mockAmqplibClient = AmqplibClient as jest.MockedClass<typeof AmqplibClient>;
        mockAmqplibClient.prototype.connect.mockRejectedValue(error);
        return mockAmqplibClient;
    };

    const setupPublisherMock = () => {
        const mockPublisherCreator = RunMQPublisherCreator as jest.MockedClass<typeof RunMQPublisherCreator>;
        const mockPublisher = {publish: jest.fn()};
        mockPublisherCreator.prototype.createPublisher.mockReturnValue(mockPublisher as any);
        return {mockPublisherCreator, mockPublisher};
    };

    const setupConsumerMock = () => {
        return RunMQConsumerCreator as jest.MockedClass<typeof RunMQConsumerCreator>;
    };

    beforeEach(() => {
        jest.clearAllMocks();
        (RunMQUtils.delay as jest.Mock).mockImplementation(() => Promise.resolve());
    });

    describe('start', () => {
        it('should create instance and connect successfully', async () => {
            const mockAmqplibClient = setupSuccessfulAmqplibClientMock();

            await RunMQ.start(validConfig);

            expect(mockAmqplibClient).toHaveBeenCalledWith(validConfig);
            expect(mockAmqplibClient.prototype.connect).toHaveBeenCalled();
            expect(mockAmqplibClient.prototype.getChannel).toHaveBeenCalled();
            expect(mockChannel.assertExchange).toHaveBeenCalledWith(
                Constants.ROUTER_EXCHANGE_NAME,
                'direct',
                {durable: true}
            );
            expect(mockChannel.assertExchange).toHaveBeenCalledWith(
                Constants.DEAD_LETTER_ROUTER_EXCHANGE_NAME,
                'direct',
                {durable: true}
            );
        });

        it('should use default config values when not provided', async () => {
            const minimalConfig = {url: RunMQConnectionConfigExample.valid().url};
            const mockAmqplibClient = setupSuccessfulAmqplibClientMock();

            await RunMQ.start(minimalConfig);

            expect(mockAmqplibClient).toHaveBeenCalledWith({
                ...minimalConfig,
                reconnectDelay: 5000,
                maxReconnectAttempts: 5
            });
        });

        it('should retry connection on failure', async () => {
            const mockAmqplibClient = AmqplibClient as jest.MockedClass<typeof AmqplibClient>;
            mockAmqplibClient.prototype.connect
                .mockRejectedValueOnce(new Error('Connection failed'))
                .mockRejectedValueOnce(new Error('Connection failed'))
                .mockResolvedValueOnce({} as any);
            mockAmqplibClient.prototype.getChannel.mockResolvedValue(mockChannel as Channel);

            await RunMQ.start(validConfig, MockedRunMQLogger);

            expect(mockAmqplibClient.prototype.connect).toHaveBeenCalledTimes(3);
            expect(RunMQUtils.delay).toHaveBeenCalledTimes(2);
            expect(RunMQUtils.delay).toHaveBeenCalledWith(100);
            expect(MockedRunMQLogger.error).toHaveBeenCalledTimes(4);
            expect(MockedRunMQLogger.log).toHaveBeenCalledWith('Successfully connected to RabbitMQ');
        });

        it('should throw exception after max retry attempts', async () => {
            setupFailingAmqplibClientMock(new Error('Connection failed'));

            await expect(RunMQ.start(validConfig)).rejects.toThrow(RunMQException);
            await expect(RunMQ.start(validConfig)).rejects.toMatchObject({
                exception: Exceptions.EXCEEDING_CONNECTION_ATTEMPTS,
                details: {attempts: 3, error: 'Connection failed'}
            });
        });
    });

    describe('process', () => {
        it('should create consumer with correct configuration', async () => {
            setupSuccessfulAmqplibClientMock();
            const mockConsumerCreator = setupConsumerMock();

            const runMQ = await RunMQ.start(validConfig);
            const processorConfig = RunMQProcessorConfigurationExample.simpleNoSchema();
            const processor = jest.fn();

            await runMQ.process('test.topic', processorConfig, processor);

            expect(mockConsumerCreator).toHaveBeenCalledWith(
                mockChannel,
                expect.any(AmqplibClient),
                expect.any(Object)
            );
            expect(mockConsumerCreator.prototype.createConsumer).toHaveBeenCalledWith(
                expect.objectContaining({
                    topic: 'test.topic',
                    processorConfig: processorConfig,
                    processor: processor
                })
            );
        });
    });

    describe('producer', () => {
        it('should throw error if message is not a valid record', async () => {
            setupSuccessfulAmqplibClientMock();
            const runMQ = await RunMQ.start(validConfig);

            expect(() => {
                runMQ.publish('test.topic', "invalid message" as any);
            }).toThrow(RunMQException);
        });

        it('should publish message correctly if valid record', async () => {
            setupSuccessfulAmqplibClientMock();
            const {mockPublisher} = setupPublisherMock();

            const runMQ = await RunMQ.start(validConfig);
            runMQ.publish('test.topic', MessageExample.person());

            expect(mockPublisher.publish).toHaveBeenCalledWith('test.topic', expect.any(Object));
        });
    });

    describe('disconnect', () => {
        it('should disconnect successfully', async () => {
            const mockAmqplibClient = setupSuccessfulAmqplibClientMock();
            mockAmqplibClient.prototype.disconnect.mockResolvedValue();

            const runMQ = await RunMQ.start(validConfig);
            await runMQ.disconnect();

            expect(mockAmqplibClient.prototype.disconnect).toHaveBeenCalled();
        });

        it('should throw exception on disconnect error', async () => {
            const mockAmqplibClient = setupSuccessfulAmqplibClientMock();
            mockAmqplibClient.prototype.disconnect.mockRejectedValue(new Error('Disconnect failed'));

            const runMQ = await RunMQ.start(validConfig);

            await expect(runMQ.disconnect()).rejects.toThrow(RunMQException);
            await expect(runMQ.disconnect()).rejects.toMatchObject({
                exception: Exceptions.CONNECTION_NOT_ESTABLISHED,
                details: {error: 'Disconnect failed'}
            });
        });
    });

    describe('isActive', () => {
        it('should return client active status', async () => {
            const mockAmqplibClient = setupSuccessfulAmqplibClientMock();
            mockAmqplibClient.prototype.isActive.mockReturnValue(true);

            const runMQ = await RunMQ.start(validConfig);
            const isActive = runMQ.isActive();

            expect(isActive).toBe(true);
            expect(mockAmqplibClient.prototype.isActive).toHaveBeenCalled();
        });
    });
});