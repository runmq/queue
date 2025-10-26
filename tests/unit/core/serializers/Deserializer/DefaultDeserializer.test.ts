import {
    DefaultDeserializer,
    DeserializationError,
    RunMQSchemaValidationError
} from "@src/core/serializers/deserializer/DefaultDeserializer";
import {RunMQProcessorConfiguration} from "@src/types";
import {RunMQMessage} from "@src/core/message/RunMQMessage";

describe("DefaultDeserializer", () => {
    const testProcessorConfig: RunMQProcessorConfiguration = {
        name: 'testProcessor',
        maxRetries: 3,
        consumersCount: 2,
        retryDelay: 5000,
    };

    describe('deserialize', () => {
        it("should throw SerializationError for empty string", () => {
            const serializer = new DefaultDeserializer();

            expect(() => serializer.deserialize("", testProcessorConfig))
                .toThrow(DeserializationError);
        });

        it("should throw SerializationError if not valid JSON", () => {
            const serializer = new DefaultDeserializer();
            const data = "invalid json";
            expect(() => serializer.deserialize(data, testProcessorConfig))
                .toThrow(DeserializationError);
        });

        it("should throw ValidationError if valid JSON but not valid RunMQMessage", () => {
            const serializer = new DefaultDeserializer();
            const invalidMessages = [
                // Missing meta.id
                {
                    message: "data",
                    meta: {publishedAt: Date.now(), correlationId: "corr-123"}
                },
                // Missing meta.publishedAt
                {
                    message: "data",
                    meta: {id: "123", correlationId: "corr-123"}
                },
                // Missing meta entirely
                {
                    message: "data"
                },
                // Missing message entirely
                {
                    meta: {id: "123", publishedAt: Date.now(), correlationId: "corr-123"}
                },
                // Wrong type for meta.id
                {
                    message: "data",
                    meta: {id: 123, publishedAt: Date.now(), correlationId: "corr-123"}
                },
                // Wrong type for meta.publishedAt
                {
                    message: "data",
                    meta: {id: "123", publishedAt: "not-a-number", correlationId: "corr-123"}
                }
            ];

            invalidMessages.forEach((invalidMsg) => {
                const data = JSON.stringify(invalidMsg);
                expect(() => serializer.deserialize(data, testProcessorConfig))
                    .toThrow(RunMQSchemaValidationError);
            });
        });

        it("should throw ValidationError if valid RunMQMessage but message does not conform to schema", () => {
            const serializer = new DefaultDeserializer();
            const data = JSON.stringify({
                message: {
                    field1: "value1",
                    field2: "string instead of number"
                }, meta: {
                    id: "123",
                    correlationId: "corr-123",
                    publishedAt: Date.now()
                }
            });
            const processorConfigWithSchema: RunMQProcessorConfiguration = {
                ...testProcessorConfig,
                messageSchema: {
                    type: 'ajv',
                    schema: {
                        type: "object",
                        properties: {
                            field1: {type: "string"},
                            field2: {type: "number"}
                        },
                        required: ["field1", "field2"],
                        additionalProperties: false
                    },
                    failureStrategy: 'dlq'
                }
            };
            expect(() => serializer.deserialize(data, processorConfigWithSchema))
                .toThrow(RunMQSchemaValidationError);
        });

        it("should throw ValidationError with error details when schema validation fails", () => {
            const serializer = new DefaultDeserializer();
            const data = JSON.stringify({
                message: {
                    field1: 123, // Should be string
                    field2: "abc", // Should be number
                    extraField: "not allowed" // Additional property
                },
                meta: {
                    id: "123",
                    correlationId: "corr-123",
                    publishedAt: Date.now()
                }
            });
            const processorConfigWithSchema: RunMQProcessorConfiguration = {
                ...testProcessorConfig,
                messageSchema: {
                    type: 'ajv',
                    schema: {
                        type: "object",
                        properties: {
                            field1: {type: "string"},
                            field2: {type: "number"}
                        },
                        required: ["field1", "field2"],
                        additionalProperties: false
                    },
                    failureStrategy: 'dlq'
                }
            };

            expect(() => serializer.deserialize(data, processorConfigWithSchema))
                .toThrow(expect.objectContaining({
                    name: 'ValidationError',
                    message: 'Message validation failed against schema'
                }));
        });

        it("should deserialize valid RunMQMessage JSON to RunMQMessage when schema is valid", () => {
            const serializer = new DefaultDeserializer();
            const data = JSON.stringify({
                message: {field1: "value1", field2: 2}, meta: {
                    id: "123",
                    correlationId: "corr-123",
                    publishedAt: Date.now()
                }
            });
            const processorConfigWithSchema: RunMQProcessorConfiguration = {
                ...testProcessorConfig,
                messageSchema: {
                    type: 'ajv',
                    schema: {
                        type: "object",
                        properties: {
                            field1: {type: "string"},
                            field2: {type: "number"}
                        },
                        required: ["field1", "field2"],
                        additionalProperties: false
                    },
                    failureStrategy: 'dlq'
                }
            };
            const result = serializer.deserialize(data, processorConfigWithSchema);
            expect(result).toBeInstanceOf(RunMQMessage);
            expect(result.message).toEqual({field1: "value1", field2: 2});
            expect(result.meta.id).toBe("123");
            expect(result.meta.publishedAt).toBeDefined();
        });

        it("should deserialize valid RunMQMessage JSON to RunMQMessage without schema validation", () => {
            const serializer = new DefaultDeserializer();
            const data = JSON.stringify({
                message: {field1: "value1", field2: 2}, meta: {
                    id: "123",
                    correlationId: "corr-123",
                    publishedAt: Date.now()
                }
            });
            const result = serializer.deserialize(data, testProcessorConfig);
            expect(result).toBeInstanceOf(RunMQMessage);
            expect(result.message).toEqual({field1: "value1", field2: 2});
            expect(result.meta.id).toBe("123");
            expect(result.meta.publishedAt).toBeDefined();
        });
    });
})
;