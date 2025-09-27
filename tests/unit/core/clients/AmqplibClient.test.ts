import * as amqp from 'amqplib';
import { AmqplibClient } from '@src/core/clients/AmqplibClient';
import { RunMQException } from '@src/core/exceptions/RunMQException';
import { Exceptions } from '@src/core/exceptions/Exceptions';
import { Channel, ChannelModel } from 'amqplib';

jest.mock('amqplib');

describe('AmqplibClient Unit Tests', () => {
    const validConfig = {
        url: 'amqp://test:test@localhost:5672'
    };

    let mockConnection: Partial<ChannelModel>;
    let mockChannel: Partial<Channel>;

    beforeEach(() => {
        jest.clearAllMocks();

        mockChannel = {
            close: jest.fn()
        };

        mockConnection = {
            createChannel: jest.fn().mockResolvedValue(mockChannel),
            close: jest.fn().mockResolvedValue(undefined),
            on: jest.fn()
        };

        (amqp.connect as jest.Mock).mockResolvedValue(mockConnection);
    });

    describe('connect', () => {
        it('should connect successfully and set up event handlers', async () => {
            const client = new AmqplibClient(validConfig);
            const connection = await client.connect();

            expect(amqp.connect).toHaveBeenCalledWith(validConfig.url);
            expect(connection).toBe(mockConnection);
            expect(client.isActive()).toBe(true);
            expect(mockConnection.on).toHaveBeenCalledWith('error', expect.any(Function));
            expect(mockConnection.on).toHaveBeenCalledWith('close', expect.any(Function));
        });

        it('should return existing connection if already connected', async () => {
            const client = new AmqplibClient(validConfig);
            
            const firstConnection = await client.connect();
            const secondConnection = await client.connect();

            expect(firstConnection).toBe(secondConnection);
            expect(amqp.connect).toHaveBeenCalledTimes(1);
        });

        it('should throw RunMQException on connection failure', async () => {
            (amqp.connect as jest.Mock).mockRejectedValue(new Error('Connection failed'));

            const client = new AmqplibClient(validConfig);

            await expect(client.connect()).rejects.toThrow(RunMQException);

            try {
                await client.connect();
            } catch (error) {
                expect(error).toBeInstanceOf(RunMQException);
                expect((error as RunMQException).exception).toBe(Exceptions.CONNECTION_NOT_ESTABLISHED);
                expect((error as RunMQException).details).toEqual({
                    error: 'Connection failed'
                });
            }

            expect(client.isActive()).toBe(false);
        });

        it('should handle error event and set isConnected to false', async () => {
            const client = new AmqplibClient(validConfig);
            await client.connect();

            const errorHandler = (mockConnection.on as jest.Mock).mock.calls.find(
                call => call[0] === 'error'
            )[1];

            errorHandler(new Error('Connection error'));

            expect(client.isActive()).toBe(false);
        });

        it('should handle close event and set isConnected to false', async () => {
            const client = new AmqplibClient(validConfig);
            await client.connect();

            const closeHandler = (mockConnection.on as jest.Mock).mock.calls.find(
                call => call[0] === 'close'
            )[1];

            closeHandler();

            expect(client.isActive()).toBe(false);
        });
    });

    describe('getChannel', () => {
        it('should create and return a channel', async () => {
            const client = new AmqplibClient(validConfig);
            const channel = await client.getChannel();

            expect(channel).toBe(mockChannel);
            expect(mockConnection.createChannel).toHaveBeenCalled();
            expect(amqp.connect).toHaveBeenCalledWith(validConfig.url);
        });

        it('should connect first if not connected', async () => {
            const client = new AmqplibClient(validConfig);
            const channel = await client.getChannel();

            expect(amqp.connect).toHaveBeenCalled();
            expect(mockConnection.createChannel).toHaveBeenCalled();
            expect(channel).toBe(mockChannel);
        });
    });

    describe('disconnect', () => {
        it('should disconnect successfully when connected', async () => {
            const client = new AmqplibClient(validConfig);
            await client.connect();
            await client.disconnect();

            expect(mockConnection.close).toHaveBeenCalled();
            expect(client.isActive()).toBe(false);
        });

        it('should do nothing if not connected', async () => {
            const client = new AmqplibClient(validConfig);
            await client.disconnect();

            expect(mockConnection.close).not.toHaveBeenCalled();
        });

        it('should throw RunMQException on disconnect failure', async () => {
            (mockConnection.close as jest.Mock).mockRejectedValue(new Error('Disconnect failed'));

            const client = new AmqplibClient(validConfig);
            await client.connect();

            await expect(client.disconnect()).rejects.toThrow(RunMQException);

            try {
                await client.disconnect();
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
        it('should return true when connected with channelModel', async () => {
            const client = new AmqplibClient(validConfig);
            await client.connect();

            expect(client.isActive()).toBe(true);
        });

        it('should return false when not connected', () => {
            const client = new AmqplibClient(validConfig);

            expect(client.isActive()).toBe(false);
        });

        it('should return false after disconnect', async () => {
            const client = new AmqplibClient(validConfig);
            await client.connect();
            await client.disconnect();

            expect(client.isActive()).toBe(false);
        });
    });
});