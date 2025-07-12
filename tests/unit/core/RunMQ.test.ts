import {RunMQ} from '@src/core/RunMQ';
import {AmqplibClient} from '@src/core/clients/amqplibClient';

describe('RunMQ', () => {
    describe('constructor', () => {
        it('should initialize with default config values', () => {
            const runMQ = new RunMQ({ url: 'amqp://localhost' });
            expect(runMQ).toBeInstanceOf(RunMQ);
        });

        it('should initialize with custom config values', () => {
            const runMQ = new RunMQ({
                url: 'amqp://localhost',
                reconnectDelay: 1000,
                maxReconnectAttempts: 3
            });
            expect(runMQ).toBeInstanceOf(RunMQ);
        });

        it('should use AmqplibClient singleton', () => {
            const runMQ = new RunMQ({ url: 'amqp://localhost' });
            const client1 = AmqplibClient.getInstance();
            const client2 = AmqplibClient.getInstance();
            expect(client1).toBe(client2);
            expect(runMQ).toBeInstanceOf(RunMQ);
        });
    });
});