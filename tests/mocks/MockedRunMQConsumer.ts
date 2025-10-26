import {RunMQConsumer} from "@src/types";
import {RabbitMQMessage} from "@src/core/message/RabbitMQMessage";

export class MockedRabbitMQConsumer implements RunMQConsumer {
    public consume = jest.fn();
}

export class MockedThrowableRabbitMQConsumer implements RunMQConsumer {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    consume(message: RabbitMQMessage): Promise<boolean> {
        return Promise.reject(new Error("Mocked error"));
    }
}

export class MockedSuccessfulRabbitMQConsumer implements RunMQConsumer {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    consume(message: RabbitMQMessage): Promise<boolean> {
        return Promise.resolve(true);
    }
}

export class MockedFailedRabbitMQConsumer implements RunMQConsumer {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    consume(message: RabbitMQMessage): Promise<boolean> {
        return Promise.resolve(false);
    }
}