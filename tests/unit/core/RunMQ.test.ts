import { RunMQ } from '@src/core/RunMQ';
import { AmqplibClient } from '@src/core/clients/AmqplibClient';
import { RunMQException } from '@src/core/exceptions/RunMQException';
import { Exceptions } from '@src/core/exceptions/Exceptions';
import { RunMQUtils } from '@src/core/utils/Utils';
import { RunMQConsumerCreator } from '@src/core/consumer/RunMQConsumerCreator';
import { Channel } from 'amqplib';
import { Constants } from '@src/core/constants';

jest.mock('@src/core/clients/AmqplibClient');
jest.mock('@src/core/utils/Utils');
jest.mock('@src/core/consumer/RunMQConsumerCreator');

describe('RunMQ Unit Tests', () => {
    const mockChannel: Partial<Channel> = {
        assertExchange: jest.fn(),
        close: jest.fn()
    };

    const validConfig = {
        url: 'amqp://test:test@localhost:5672',
        reconnectDelay: 100,
        maxReconnectAttempts: 3
    };

    beforeEach(() => {
        jest.clearAllMocks();
        (RunMQUtils.delay as jest.Mock).mockImplementation(() => Promise.resolve());
    });

    describe('start', () => {
        it('should create instance and connect successfully', async () => {
            const mockAmqplibClient = AmqplibClient as jest.MockedClass<typeof AmqplibClient>;
            mockAmqplibClient.prototype.connect.mockResolvedValue({} as any);
            mockAmqplibClient.prototype.getChannel.mockResolvedValue(mockChannel as Channel);

            await RunMQ.start(validConfig);

            expect(mockAmqplibClient).toHaveBeenCalledWith(validConfig);
            expect(mockAmqplibClient.prototype.connect).toHaveBeenCalled();
            expect(mockAmqplibClient.prototype.getChannel).toHaveBeenCalled();
            expect(mockChannel.assertExchange).toHaveBeenCalledWith(
                Constants.ROUTER_EXCHANGE_NAME,
                'direct',
                { durable: true }
            );
            expect(mockChannel.assertExchange).toHaveBeenCalledWith(
                Constants.DEAD_LETTER_ROUTER_EXCHANGE_NAME,
                'direct',
                { durable: true }
            );
        });

        it('should use default config values when not provided', async () => {
            const minimalConfig = { url: 'amqp://test:test@localhost:5672' };
            const mockAmqplibClient = AmqplibClient as jest.MockedClass<typeof AmqplibClient>;
            mockAmqplibClient.prototype.connect.mockResolvedValue({} as any);
            mockAmqplibClient.prototype.getChannel.mockResolvedValue(mockChannel as Channel);

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

            const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
            const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

            await RunMQ.start(validConfig);

            expect(mockAmqplibClient.prototype.connect).toHaveBeenCalledTimes(3);
            expect(RunMQUtils.delay).toHaveBeenCalledTimes(2);
            expect(RunMQUtils.delay).toHaveBeenCalledWith(100);
            expect(consoleErrorSpy).toHaveBeenCalledTimes(2);
            expect(consoleLogSpy).toHaveBeenCalledWith('Successfully connected to RabbitMQ');

            consoleLogSpy.mockRestore();
            consoleErrorSpy.mockRestore();
        });

        it('should throw exception after max retry attempts', async () => {
            const mockAmqplibClient = AmqplibClient as jest.MockedClass<typeof AmqplibClient>;
            mockAmqplibClient.prototype.connect.mockRejectedValue(new Error('Connection failed'));

            const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

            await expect(RunMQ.start(validConfig)).rejects.toThrow(RunMQException);

            try {
                await RunMQ.start(validConfig);
            } catch (error) {
                expect(error).toBeInstanceOf(RunMQException);
                expect((error as RunMQException).exception).toBe(Exceptions.EXCEEDING_CONNECTION_ATTEMPTS);
                expect((error as RunMQException).details).toEqual({
                    attempts: 3,
                    error: 'Connection failed'
                });
            }

            expect(mockAmqplibClient.prototype.connect).toHaveBeenCalledTimes(6); // 3 + 3
            expect(RunMQUtils.delay).toHaveBeenCalledTimes(4); // 2 + 2

            consoleErrorSpy.mockRestore();
        });
    });

    describe('process', () => {
        it('should create consumer with correct configuration', async () => {
            const mockAmqplibClient = AmqplibClient as jest.MockedClass<typeof AmqplibClient>;
            mockAmqplibClient.prototype.connect.mockResolvedValue({} as any);
            mockAmqplibClient.prototype.getChannel.mockResolvedValue(mockChannel as Channel);

            const mockConsumerCreator = RunMQConsumerCreator as jest.MockedClass<typeof RunMQConsumerCreator>;
            mockConsumerCreator.prototype.createConsumer.mockResolvedValue(undefined);

            const runMQ = await RunMQ.start(validConfig);

            const processorConfig = {
                name: 'testProcessor',
                maxRetries: 3,
                consumersCount: 1,
                retryDelay: 60000,
                cls: class TestMessage {}
            };

            const processor = jest.fn();

            await runMQ.process('test.topic', processorConfig, processor);

            expect(mockConsumerCreator).toHaveBeenCalledWith(
                mockChannel,
                expect.any(AmqplibClient),
                expect.any(Object) // logger
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

    describe('disconnect', () => {
        it('should disconnect successfully', async () => {
            const mockAmqplibClient = AmqplibClient as jest.MockedClass<typeof AmqplibClient>;
            mockAmqplibClient.prototype.connect.mockResolvedValue({} as any);
            mockAmqplibClient.prototype.getChannel.mockResolvedValue(mockChannel as Channel);
            mockAmqplibClient.prototype.disconnect.mockResolvedValue();

            const runMQ = await RunMQ.start(validConfig);
            await runMQ.disconnect();

            expect(mockAmqplibClient.prototype.disconnect).toHaveBeenCalled();
        });

        it('should throw exception on disconnect error', async () => {
            const mockAmqplibClient = AmqplibClient as jest.MockedClass<typeof AmqplibClient>;
            mockAmqplibClient.prototype.connect.mockResolvedValue({} as any);
            mockAmqplibClient.prototype.getChannel.mockResolvedValue(mockChannel as Channel);
            mockAmqplibClient.prototype.disconnect.mockRejectedValue(new Error('Disconnect failed'));

            const runMQ = await RunMQ.start(validConfig);

            await expect(runMQ.disconnect()).rejects.toThrow(RunMQException);

            try {
                await runMQ.disconnect();
            } catch (error) {
                expect(error).toBeInstanceOf(RunMQException);
                expect((error as RunMQException).exception).toBe(Exceptions.CONNECTION_NOT_ESTABLISHED);
                expect((error as RunMQException).details).toEqual({
                    error: 'Disconnect failed'
                });
            }
        });
    });

    describe('isActive', () => {
        it('should return client active status', async () => {
            const mockAmqplibClient = AmqplibClient as jest.MockedClass<typeof AmqplibClient>;
            mockAmqplibClient.prototype.connect.mockResolvedValue({} as any);
            mockAmqplibClient.prototype.getChannel.mockResolvedValue(mockChannel as Channel);
            mockAmqplibClient.prototype.isActive.mockReturnValue(true);

            const runMQ = await RunMQ.start(validConfig);
            const isActive = runMQ.isActive();

            expect(isActive).toBe(true);
            expect(mockAmqplibClient.prototype.isActive).toHaveBeenCalled();
        });
    });
});