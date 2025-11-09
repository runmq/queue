import {RabbitMQOperatorPolicy} from "@src/types";
import {RunMQUtils} from "@src/core/utils/RunMQUtils";
import {ConsumerCreatorUtils} from "@src/core/consumer/ConsumerCreatorUtils";

export class RabbitMQMessageTTLPolicy {
    static createFor(queueName: string, ttl: number): RabbitMQOperatorPolicy {
        return {
            name: ConsumerCreatorUtils.getMessageTTLPolicyName(queueName),
            pattern: RunMQUtils.escapeRegExp(queueName),
            definition: {
                "message-ttl": ttl
            },
            "apply-to": "queues",
            priority: 1000
        }
    }
}