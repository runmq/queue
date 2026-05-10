import {RunMQPublisher} from "@src/types";

export class MockedRabbitMQPublisher implements RunMQPublisher {
    public publish = jest.fn().mockResolvedValue(undefined);
}