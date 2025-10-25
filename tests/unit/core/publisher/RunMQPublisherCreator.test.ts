import {RunMQPublisherCreator} from '@src/core/publisher/RunMQPublisherCreator';
import {RunMQLogger} from '@src/core/logging/RunMQLogger';
import {RunMQFailureLoggerProducer} from '@src/core/publisher/producers/RunMQFailureLoggerProducer';
import {RunMQBaseProducer} from '@src/core/publisher/producers/RunMQBaseProducer';
import {DefaultSerializer} from '@src/core/serializers/DefaultSerializer';
import {Channel} from 'amqplib';

jest.mock('@src/core/publisher/producers/RunMQFailureLoggerProducer');
jest.mock('@src/core/publisher/producers/RunMQBaseProducer');
jest.mock('@src/core/serializers/DefaultSerializer');

describe('RunMQPublisherCreator Unit Tests', () => {
    let mockChannel: jest.Mocked<Channel>;
    let mockLogger: jest.Mocked<RunMQLogger>;
    let publisherCreator: RunMQPublisherCreator;

    beforeEach(() => {
        jest.clearAllMocks();

        mockChannel = {
            publish: jest.fn()
        } as any;

        mockLogger = {
            info: jest.fn(),
            warn: jest.fn(),
            error: jest.fn(),
            debug: jest.fn(),
            log: jest.fn(),
            verbose: jest.fn(),
        };

        publisherCreator = new RunMQPublisherCreator(mockChannel, mockLogger);
    });

    describe('createPublisher', () => {
        it('should create RunMQFailureLoggerProducer with correct dependencies', () => {
            const publisher = publisherCreator.createPublisher();

            expect(RunMQBaseProducer).toHaveBeenCalledWith(
                mockChannel,
                expect.any(DefaultSerializer)
            );
            expect(RunMQFailureLoggerProducer).toHaveBeenCalledWith(
                expect.any(RunMQBaseProducer),
                mockLogger
            );
            expect(publisher).toBeInstanceOf(RunMQFailureLoggerProducer);
        });

        it('should create DefaultSerializer instance', () => {
            publisherCreator.createPublisher();

            expect(DefaultSerializer).toHaveBeenCalledTimes(1);
            expect(DefaultSerializer).toHaveBeenCalledWith();
        });

        it('should pass the correct channel to RunMQBaseProducer', () => {
            const customChannel = {publish: jest.fn()} as any;
            const customPublisherCreator = new RunMQPublisherCreator(customChannel, mockLogger);

            customPublisherCreator.createPublisher();

            expect(RunMQBaseProducer).toHaveBeenCalledWith(
                customChannel,
                expect.any(DefaultSerializer)
            );
        });

        it('should pass the correct logger to RunMQFailureLoggerProducer', () => {
            const customLogger = {
                info: jest.fn(),
                warn: jest.fn(),
                error: jest.fn(),
                debug: jest.fn(),
                log: jest.fn(),
                verbose: jest.fn(),
            };
            const customPublisherCreator = new RunMQPublisherCreator(mockChannel, customLogger);

            customPublisherCreator.createPublisher();

            expect(RunMQFailureLoggerProducer).toHaveBeenCalledWith(
                expect.any(RunMQBaseProducer),
                customLogger
            );
        });

        it('should return the same publisher instance on multiple calls', () => {
            const publisher1 = publisherCreator.createPublisher();
            const publisher2 = publisherCreator.createPublisher();

            expect(publisher1).toBeInstanceOf(RunMQFailureLoggerProducer);
            expect(publisher2).toBeInstanceOf(RunMQFailureLoggerProducer);
        });
    });
});
