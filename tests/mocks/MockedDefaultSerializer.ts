import {RunMQMessage} from "@src/core/message/RunMQMessage";
import {Serializer} from "@src/core/serializers/Serializer";

export class MockedDefaultSerializer implements Serializer {
    serialize = jest.fn((data: RunMQMessage) => {
        return JSON.stringify(data);
    })
}