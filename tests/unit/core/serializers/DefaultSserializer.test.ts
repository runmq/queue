import {RunMQMessage, RunMQMessageMeta} from "@src/core/message/RunMQMessage";
import {DefaultSerializer} from "@src/core/serializers/DefaultSerializer";

describe("DefaultDeserializer", () => {

    describe('serialize', () => {
        const serializer = new DefaultSerializer();
        it("should serialize a RunMQMessage to JSON string", () => {
            const message = new RunMQMessage(
                {field1: "value1", field2: 123},
                new RunMQMessageMeta("test-id", Date.now())
            );

            const result = serializer.serialize(message);
            const parsed = JSON.parse(result);

            expect(parsed.message).toEqual({field1: "value1", field2: 123});
            expect(parsed.meta.id).toBe("test-id");
            expect(parsed.meta.publishedAt).toBeDefined();
        });

        it("should serialize complex nested objects", () => {
            const complexData = {
                nested: {
                    array: [1, 2, 3],
                    object: {key: "value"},
                    null: null,
                    boolean: true
                }
            };
            const message = new RunMQMessage(
                complexData,
                new RunMQMessageMeta("complex-id", 1234567890)
            );

            const result = serializer.serialize(message);
            const parsed = JSON.parse(result);

            expect(parsed.message).toEqual(complexData);
        });
    });
});