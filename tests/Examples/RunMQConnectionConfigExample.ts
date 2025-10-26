import {RunMQConnectionConfig} from "@src/types";
import {faker} from "@faker-js/faker";

export class RunMQConnectionConfigExample {
    static random(
        url: string = faker.internet.url(),
        reconnectDelay = faker.number.int({min: 1, max: 3}),
        maxReconnectAttempts = faker.number.int({min: 1, max: 10})
    ): RunMQConnectionConfig {
        return {
            url,
            reconnectDelay,
            maxReconnectAttempts
        }
    }


    static valid(): RunMQConnectionConfig {
        return this.random(
            'amqp://test:test@localhost:5673',
            100,
            3
        );
    }

    static invalid(): RunMQConnectionConfig {
        return this.random(
            'amqp://invalid:invalid@localhost:9999',
            100,
            2
        );
    }
}