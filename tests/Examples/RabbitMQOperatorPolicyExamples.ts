import {RabbitMQMessageTTLPolicy} from "@src/core/management/Policies/RabbitMQMessageTTLPolicy";
import {faker} from "@faker-js/faker";

export class RabbitMQMessageTTLPolicyExample {
    static validPolicy(
        queueName: string = faker.lorem.word(),
        ttl: number = 5000
    ) {
        return RabbitMQMessageTTLPolicy.createFor(queueName, ttl);
    }
}