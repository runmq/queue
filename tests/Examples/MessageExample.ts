import {faker} from "@faker-js/faker";

export class MessageExample {
    static person() {
        return {
            name: faker.person.firstName(),
            age: faker.number.int({min: 1, max: 50}),
            email: faker.internet.email(),
        }
    }
}