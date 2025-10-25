import {RunMQLogger} from "@src/core/logging/RunMQLogger";
import {RunMQPublisher} from "@src/types";
import {RunMQFailureLoggerProducer} from "@src/core/publisher/producers/RunMQFailureLoggerProducer";
import {RunMQBaseProducer} from "@src/core/publisher/producers/RunMQBaseProducer";
import {DefaultSerializer} from "@src/core/serializers/DefaultSerializer";
import {Constants} from "@src/core/constants";

export class RunMQPublisherCreator {
    constructor(
        private logger: RunMQLogger) {
    }

    public createPublisher(exchange = Constants.ROUTER_EXCHANGE_NAME): RunMQPublisher {
        return new RunMQFailureLoggerProducer(
            new RunMQBaseProducer(new DefaultSerializer(), exchange),
            this.logger
        );
    }
}