import {DefaultDeserializer} from "@src/core/serializers/deserializer/DefaultDeserializer";

export class MockedDefaultDeserializer implements DefaultDeserializer<any> {
    deserialize = jest.fn();
}