import {RunMQPublisherCreator} from '@src/core/publisher/RunMQPublisherCreator';
import {RunMQFailureLoggerProducer} from '@src/core/publisher/producers/RunMQFailureLoggerProducer';
import {RunMQBaseProducer} from '@src/core/publisher/producers/RunMQBaseProducer';
import {DefaultSerializer} from '@src/core/serializers/DefaultSerializer';
import {Constants} from "@src/core/constants";
import {MockedRunMQLogger} from "@tests/mocks/MockedRunMQLogger";

jest.mock('@src/core/publisher/producers/RunMQFailureLoggerProducer');
jest.mock('@src/core/publisher/producers/RunMQBaseProducer');
jest.mock('@src/core/serializers/DefaultSerializer');

describe('RunMQPublisherCreator Unit Tests', () => {
    let publisherCreator: RunMQPublisherCreator;

    beforeEach(() => {
        jest.clearAllMocks();
        publisherCreator = new RunMQPublisherCreator(MockedRunMQLogger);
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
                MockedRunMQLogger
            );
            expect(publisher).toBeInstanceOf(RunMQFailureLoggerProducer);
        });

        it('should create DefaultSerializer instance', () => {
            publisherCreator.createPublisher();

            expect(DefaultSerializer).toHaveBeenCalledTimes(1);
            expect(DefaultSerializer).toHaveBeenCalledWith();
        });

        it('should pass the correct logger to RunMQFailureLoggerProducer', () => {
            const customPublisherCreator = new RunMQPublisherCreator(MockedRunMQLogger);

            customPublisherCreator.createPublisher();

            expect(RunMQFailureLoggerProducer).toHaveBeenCalledWith(
                expect.any(RunMQBaseProducer),
                MockedRunMQLogger
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
