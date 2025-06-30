import {AmqplibConnector} from "@src/core/strategies/AmqlibConnector";
import {Exceptions} from "@src/core/exceptions/Exceptions";
import {RunMQException} from "@src/core/exceptions/RunMQException";

describe('AmqplibConnector', () => {
    it('should throw exception if trying to get connection before connecting', async () => {
        const connectorInstance = AmqplibConnector.getInstance();
        try {
            await connectorInstance.getConnection();
            fail('Should have thrown an error');
        } catch (error: RunMQException | unknown) {
            const e = error as RunMQException;
            expect(e).toBeInstanceOf(RunMQException);
            expect(e.exception).toBe(Exceptions.CONNECTION_NOT_ESTABLISHED);
            expect(e.details.message).toBe('Connection not established. Call connect() first.');
        }
    });

    it('should retry connecting for max attempts and then throw EXCEEDING_CONNECTION_ATTEMPTS', async () => {
        const connectorInstance = AmqplibConnector.getInstance();
        try {
            await connectorInstance.connect({
                url: 'amqp://incorrect:incorrect@localhost',
                maxReconnectAttempts: 3,
                reconnectDelay: 100
            });
            throw new Error('Should have thrown an error');
        } catch (error: RunMQException | unknown) {
            const e = error as RunMQException;
            expect(e).toBeInstanceOf(RunMQException);
            expect(e.exception).toBe(Exceptions.EXCEEDING_CONNECTION_ATTEMPTS);
        }
    });
})