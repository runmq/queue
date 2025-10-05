import {RunMQLogger} from "@src/core/logging/RunMQLogger";
import {RunMQPublisher} from "@src/types";
import {RunMQFailureLoggerProducer} from "@src/core/publisher/producers/RunMQFailureLoggerProducer";
import {RunMQBaseProducer} from "@src/core/publisher/producers/RunMQBaseProducer";
import {Channel} from "amqplib";
import {DefaultSerializer} from "@src/core/serializers/DefaultSerializer";

export class RunMQPublisherCreator {
    constructor(
        private channel: Channel,
        private logger: RunMQLogger) {
    }

    public createPublisher(): RunMQPublisher {
        return new RunMQFailureLoggerProducer(
            new RunMQBaseProducer(this.channel, new DefaultSerializer()),
            this.logger
        );
    }
}