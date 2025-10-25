import {RunMQPublisherCreator} from '@src/core/publisher/RunMQPublisherCreator';
import {RunMQLogger} from '@src/core/logging/RunMQLogger';
import {RunMQFailureLoggerProducer} from '@src/core/publisher/producers/RunMQFailureLoggerProducer';
import {RunMQBaseProducer} from '@src/core/publisher/producers/RunMQBaseProducer';
import {DefaultSerializer} from '@src/core/serializers/DefaultSerializer';
import {Constants} from "@src/core/constants";

jest.mock('@src/core/publisher/producers/RunMQFailureLoggerProducer');
jest.mock('@src/core/publisher/producers/RunMQBaseProducer');
jest.mock('@src/core/serializers/DefaultSerializer');

describe('RunMQPublisherCreator Unit Tests', () => {
    let mockLogger: jest.Mocked<RunMQLogger>;
    let publisherCreator: RunMQPublisherCreator;

    beforeEach(() => {
        jest.clearAllMocks();

        mockLogger = {
            info: jest.fn(),
            warn: jest.fn(),
            error: jest.fn(),
            debug: jest.fn(),
            log: jest.fn(),
            verbose: jest.fn(),
        };

        publisherCreator = new RunMQPublisherCreator(mockLogger);
    });

    describe('createPublisher', () => {
        it('should create RunMQFailureLoggerProducer with correct dependencies', () => {
            const publisher = publisherCreator.createPublisher();

            expect(RunMQBaseProducer).toHaveBeenCalledWith(
                expect.any(DefaultSerializer),
                Constants.ROUTER_EXCHANGE_NAME,
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

        it('should pass the correct logger to RunMQFailureLoggerProducer', () => {
            const customLogger = {
                info: jest.fn(),
                warn: jest.fn(),
                error: jest.fn(),
                debug: jest.fn(),
                log: jest.fn(),
                verbose: jest.fn(),
            };
            const customPublisherCreator = new RunMQPublisherCreator(customLogger);

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
