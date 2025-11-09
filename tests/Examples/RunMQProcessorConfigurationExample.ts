import {MessageSchema, RunMQProcessorConfiguration, SchemaFailureStrategy, SchemaType} from "@src/types";
import {faker} from "@faker-js/faker";

export class RunMQProcessorConfigurationExample {
    static random(
        name: string = faker.lorem.word(),
        consumersCount = faker.number.int({min: 1, max: 10}),
        attempts = faker.number.int({min: 0, max: 10}),
        attemptsDelay = faker.number.int({min: 10, max: 1000}),
        messageSchema = MessageSchemaExample.random(),
        usePoliciesForDelay: boolean = false
    ): RunMQProcessorConfiguration {
        return {
            name,
            consumersCount,
            attempts,
            attemptsDelay,
            messageSchema,
            usePoliciesForDelay
        }
    }

    static simpleNoSchema(
        name: string = faker.lorem.word(),
        consumersCount: number = 1,
        usePoliciesForDelay: boolean = false
    ): RunMQProcessorConfiguration {
        return this.random(
            name,
            consumersCount,
            3,
            100,
            undefined,
            usePoliciesForDelay
        );
    }


    static simpleWithPersonSchema(attempts: number = 3): RunMQProcessorConfiguration {
        return this.random(
            'person_processor',
            1,
            attempts,
            100,
            MessageSchemaExample.simplePersonSchema()
        )
    }

    static withAttempts(attempts: number): RunMQProcessorConfiguration {
        return this.random(
            faker.lorem.word(),
            1,
            attempts,
            100,
            MessageSchemaExample.simplePersonSchema()
        )
    }
}


export class MessageSchemaExample {
    static random(
        type: SchemaType = 'ajv',
        schema: any = {type: 'object'},
        failureStrategy: SchemaFailureStrategy = 'dlq'
    ): MessageSchema {
        return {
            type,
            schema,
            failureStrategy
        }
    }

    static simplePersonSchema(): MessageSchema {
        return this.random(
            'ajv',
            {
                type: 'object',
                properties: {
                    name: {type: 'string'},
                    age: {type: 'integer'},
                    email: {type: 'string'}
                },
                required: ['name', 'age', 'email'],
                additionalProperties: false
            },
            'dlq'
        )
    }
}