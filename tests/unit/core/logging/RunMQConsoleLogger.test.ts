import { RUNMQConsoleLogger } from '@src/core/logging/RunMQConsoleLogger';

describe('RUNMQConsoleLogger Unit Tests', () => {
    let logger: RUNMQConsoleLogger;
    let consoleLogSpy: jest.SpyInstance;
    let consoleErrorSpy: jest.SpyInstance;
    let consoleWarnSpy: jest.SpyInstance;
    let consoleInfoSpy: jest.SpyInstance;
    let consoleDebugSpy: jest.SpyInstance;

    beforeEach(() => {
        logger = new RUNMQConsoleLogger();
        
        consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
        consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
        consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
        consoleInfoSpy = jest.spyOn(console, 'info').mockImplementation();
        consoleDebugSpy = jest.spyOn(console, 'debug').mockImplementation();
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    describe('log method', () => {
        it('should log message with prefix', () => {
            const message = 'Test log message';
            logger.log(message);

            expect(consoleLogSpy).toHaveBeenCalledWith("[RunMQ] -  " + message);
            expect(consoleLogSpy).toHaveBeenCalledTimes(1);
        });
    });

    describe('error method', () => {
        it('should log error with prefix', () => {
            const message = 'Error message';
            logger.error(message);

            expect(consoleErrorSpy).toHaveBeenCalledWith('[RunMQ] -  Error message');
        });

        it('should pass optional parameters', () => {
            const message = 'Error with params';
            const error = new Error('Test error');
            const details = { code: 'ERR001' };

            logger.error(message, error, details);

            expect(consoleErrorSpy).toHaveBeenCalledWith(
                '[RunMQ] -  Error with params',
                error,
                details
            );
        });

        it('should handle multiple optional parameters', () => {
            logger.error('Multiple params', 1, 'two', { three: 3 }, [4]);

            expect(consoleErrorSpy).toHaveBeenCalledWith(
                '[RunMQ] -  Multiple params',
                1,
                'two',
                { three: 3 },
                [4]
            );
        });
    });

    describe('warn method', () => {
        it('should log warning with prefix', () => {
            const message = 'Warning message';
            logger.warn(message);

            expect(consoleWarnSpy).toHaveBeenCalledWith('[RunMQ] -  Warning message');
        });

        it('should pass optional parameters', () => {
            const message = 'Warning with params';
            const data = { severity: 'medium' };

            logger.warn(message, data);

            expect(consoleWarnSpy).toHaveBeenCalledWith(
                '[RunMQ] -  Warning with params',
                data
            );
        });
    });

    describe('info method', () => {
        it('should log info with prefix', () => {
            const message = 'Info message';
            logger.info(message);

            expect(consoleInfoSpy).toHaveBeenCalledWith('[RunMQ] -  Info message');
        });

        it('should pass optional parameters', () => {
            const message = 'Info with metadata';
            const metadata = { user: 'test', action: 'login' };

            logger.info(message, metadata);

            expect(consoleInfoSpy).toHaveBeenCalledWith(
                '[RunMQ] -  Info with metadata',
                metadata
            );
        });
    });

    describe('debug method', () => {
        it('should log debug with prefix', () => {
            const message = 'Debug message';
            logger.debug(message);

            expect(consoleDebugSpy).toHaveBeenCalledWith('[RunMQ] -  Debug message');
        });

        it('should pass optional parameters', () => {
            const message = 'Debug trace';
            const trace = { function: 'processMessage', line: 42 };

            logger.debug(message, trace);

            expect(consoleDebugSpy).toHaveBeenCalledWith(
                '[RunMQ] -  Debug trace',
                trace
            );
        });
    });

    describe('verbose method', () => {
        it('should log verbose message using console.debug with prefix', () => {
            const message = 'Verbose message';
            logger.verbose(message);

            expect(consoleDebugSpy).toHaveBeenCalledWith('[RunMQ] -  Verbose message');
        });

        it('should pass optional parameters', () => {
            const message = 'Verbose details';
            const details = { step: 1, total: 10 };

            logger.verbose(message, details);

            expect(consoleDebugSpy).toHaveBeenCalledWith(
                '[RunMQ] -  Verbose details',
                details
            );
        });
    });

    describe('prefix handling', () => {
        it('should have correct prefix property', () => {
            expect(logger.prefix).toBe('[RunMQ] - ');
        });

        it('should format messages correctly', () => {
            const testCases = [
                { method: 'error', spy: consoleErrorSpy },
                { method: 'warn', spy: consoleWarnSpy },
                { method: 'info', spy: consoleInfoSpy },
                { method: 'debug', spy: consoleDebugSpy },
                { method: 'verbose', spy: consoleDebugSpy }
            ];

            testCases.forEach(({ method, spy }) => {
                spy.mockClear();
                (logger as any)[method]('Test message');
                expect(spy).toHaveBeenCalledWith('[RunMQ] -  Test message');
            });
        });

        it('should handle special characters in messages', () => {
            const specialMessage = 'Message with \n newline and \t tab';
            logger.error(specialMessage);

            expect(consoleErrorSpy).toHaveBeenCalledWith(
                '[RunMQ] -  Message with \n newline and \t tab'
            );
        });
    });

    describe('edge cases', () => {
        it('should handle undefined optional parameters', () => {
            logger.error('Error', undefined, null);

            expect(consoleErrorSpy).toHaveBeenCalledWith(
                '[RunMQ] -  Error',
                undefined,
                null
            );
        });

        it('should handle empty optional parameters array', () => {
            logger.info('Info');

            expect(consoleInfoSpy).toHaveBeenCalledWith('[RunMQ] -  Info');
        });

        it('should handle very long messages', () => {
            const longMessage = 'x'.repeat(1000);
            logger.warn(longMessage);

            expect(consoleWarnSpy).toHaveBeenCalledWith(`[RunMQ] -  ${longMessage}`);
        });
    });
});