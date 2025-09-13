import {RunMQ} from '@src/core/RunMQ';
import {RunMQException} from '@src/core/exceptions/RunMQException';
import {Exceptions} from '@src/core/exceptions/Exceptions';

describe('RunMQ E2E Tests', () => {
    const validConfig = {
        url: 'amqp://test:test@localhost:5673',
        reconnectDelay: 100,
        maxReconnectAttempts: 3
    };
    
    const invalidConfig = {
        url: 'amqp://invalid:invalid@localhost:9999',
        reconnectDelay: 100,
        maxReconnectAttempts: 2
    };

    describe('connection with retry logic', () => {
        it('should connect successfully on first attempt', async () => {
            const runMQ = await RunMQ.start(validConfig);
            expect(runMQ.isActive()).toBe(true);
            await runMQ.disconnect();
        }, 15000);

        it('should retry and eventually fail with invalid config', async () => {
            const startTime = Date.now();
            await expect(RunMQ.start(invalidConfig)).rejects.toThrow(RunMQException);
            const endTime = Date.now();
            
            // Should have taken at least the retry delay time
            expect(endTime - startTime).toBeGreaterThan(invalidConfig.reconnectDelay);
            
            try {
                await RunMQ.start(invalidConfig);
            } catch (error) {
                expect(error).toBeInstanceOf(RunMQException);
                expect((error as RunMQException).exception).toBe(Exceptions.EXCEEDING_CONNECTION_ATTEMPTS);
                expect((error as RunMQException).details.attempts).toBe(invalidConfig.maxReconnectAttempts);
            }
        }, 20000);

        it('should connect after temporary network issues', async () => {
            await expect(RunMQ.start(invalidConfig)).rejects.toThrow(RunMQException);
            
            const validRunMQ = await RunMQ.start(validConfig);
            expect(validRunMQ.isActive()).toBe(true);
            await validRunMQ.disconnect();
        }, 25000);

        it('should handle disconnect properly', async () => {
            const runMQ = await RunMQ.start(validConfig);
            expect(runMQ.isActive()).toBe(true);
            
            await runMQ.disconnect();
            expect(runMQ.isActive()).toBe(false);
        }, 15000);
    });

    describe('configuration handling', () => {
        it('should use default configuration values', async () => {
            const runMQ = await RunMQ.start({ url: validConfig.url });
            expect(runMQ.isActive()).toBe(true);
            await runMQ.disconnect();
        }, 15000);

        it('should use custom configuration values', async () => {
            const customConfig = {
                url: validConfig.url,
                reconnectDelay: 50,
                maxReconnectAttempts: 1
            };
            const runMQ = await RunMQ.start(customConfig);
            expect(runMQ.isActive()).toBe(true);
            await runMQ.disconnect();
        }, 15000);
    });
});