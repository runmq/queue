import {RunMQPublisher} from "@src/types";
import {RunMQLogger} from "@src/core/logging/RunMQLogger";

export class RunMQFailureLoggerProducer implements RunMQPublisher {
    constructor(private producer: RunMQPublisher, private logger: RunMQLogger) {
    }

    publish(topic: string, message: any): void {
        try {
            this.producer.publish(topic, message);
        } catch (e) {
            this.logger.error('Message publishing failed', {
                message: message.message.content.toString(),
                error: e instanceof Error ? e.message : JSON.stringify(e),
                stack: e instanceof Error ? e.stack : undefined,
            });
            throw e;
        }
    }
}