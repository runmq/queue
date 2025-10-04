import {DefaultSerializer, SerializationError, RunMQSchemaValidationError} from "@src/core/serializers/DefaultSerializer";
import {RunMQProcessorConfiguration} from "@src/types";
import {RunMQMessage, RunMQMessageMeta} from "@src/core/message/RunMQMessage";

describe("DefaultSerializer", () => {
    const testProcessorConfig: RunMQProcessorConfiguration = {
        name: 'testProcessor',
        maxRetries: 3,
        consumersCount: 2,
        retryDelay: 5000,
    };

    describe('serialize', () => {
        it("should serialize a RunMQMessage to JSON string", () => {
            const serializer = new DefaultSerializer<any>();
            const message = new RunMQMessage(
                { field1: "value1", field2: 123 },
                new RunMQMessageMeta("test-id", Date.now())
            );
            
            const result = serializer.serialize(message);
            const parsed = JSON.parse(result);
            
            expect(parsed.message).toEqual({ field1: "value1", field2: 123 });
            expect(parsed.meta.id).toBe("test-id");
            expect(parsed.meta.publishedAt).toBeDefined();
        });

        it("should serialize complex nested objects", () => {
            const serializer = new DefaultSerializer<any>();
            const complexData = {
                nested: {
                    array: [1, 2, 3],
                    object: { key: "value" },
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

        it("should throw SerializationError for circular references", () => {
            const serializer = new DefaultSerializer<any>();
            const circular: any = { prop: "value" };
            circular.self = circular;
            
            const message = new RunMQMessage(
                circular,
                new RunMQMessageMeta("circular-id", Date.now())
            );
            
            expect(() => serializer.serialize(message)).toThrow(SerializationError);
        });
    });

    describe('deserialize', () => {
        it("should throw SerializationError for empty string", () => {
            const serializer = new DefaultSerializer();
            
            expect(() => serializer.deserialize("", testProcessorConfig))
                .toThrow(SerializationError);
        });

        it("should throw SerializationError if not valid JSON", () => {
            const serializer = new DefaultSerializer();
            const data = "invalid json";
            expect(() => serializer.deserialize(data, testProcessorConfig))
                .toThrow(SerializationError);
        });

        it("should throw ValidationError if valid JSON but not valid RunMQMessage", () => {
            const serializer = new DefaultSerializer();
            const invalidMessages = [
                // Missing meta.id
                {
                    message: "data",
                    meta: { publishedAt: Date.now() }
                },
                // Missing meta.publishedAt
                {
                    message: "data",
                    meta: { id: "123" }
                },
                // Missing meta entirely
                {
                    message: "data"
                },
                // Missing message
                {
                    meta: { id: "123", publishedAt: Date.now() }
                },
                // Wrong type for meta.id
                {
                    message: "data",
                    meta: { id: 123, publishedAt: Date.now() }
                },
                // Wrong type for meta.publishedAt
                {
                    message: "data",
                    meta: { id: "123", publishedAt: "not-a-number" }
                }
            ];

            invalidMessages.forEach((invalidMsg) => {
                const data = JSON.stringify(invalidMsg);
                expect(() => serializer.deserialize(data, testProcessorConfig))
                    .toThrow(RunMQSchemaValidationError);
            });
        });

        it("should throw ValidationError if valid RunMQMessage but message does not conform to schema", () => {
            const serializer = new DefaultSerializer();
            const data = JSON.stringify({
                message: {
                    field1: "value1",
                    field2: "string instead of number"
                }, meta: {
                    id: "123",
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
            const serializer = new DefaultSerializer();
            const data = JSON.stringify({
                message: {
                    field1: 123, // Should be string
                    field2: "abc", // Should be number
                    extraField: "not allowed" // Additional property
                },
                meta: {
                    id: "123",
                    publishedAt: Date.now()
                }
            });
            const processorConfigWithSchema: RunMQProcessorConfiguration= {
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
            
            try {
                serializer.deserialize(data, processorConfigWithSchema);
                fail("Should have thrown ValidationError");
            } catch (error) {
                expect(error).toBeInstanceOf(RunMQSchemaValidationError);
                const validationError = error as RunMQSchemaValidationError;
                expect(validationError.errors).toBeDefined();
                expect(Array.isArray(validationError.errors)).toBe(true);
                expect(validationError.errors!.length).toBeGreaterThan(0);
                
                // Check that errors have the correct structure
                validationError.errors!.forEach(err => {
                    expect(err).toHaveProperty('path');
                    expect(err).toHaveProperty('rule');
                    expect(err).toHaveProperty('message');
                });
            }
        });

        it("should deserialize valid RunMQMessage JSON to RunMQMessage when schema is valid", () => {
            const serializer = new DefaultSerializer();
            const data = JSON.stringify({
                message: {field1: "value1", field2: 2}, meta: {
                    id: "123",
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
            const serializer = new DefaultSerializer();
            const data = JSON.stringify({
                message: {field1: "value1", field2: 2}, meta: {
                    id: "123",
                    publishedAt: Date.now()
                }
            });
            const result = serializer.deserialize(data, testProcessorConfig);
            expect(result).toBeInstanceOf(RunMQMessage);
            expect(result.message).toEqual({field1: "value1", field2: 2});
            expect(result.meta.id).toBe("123");
            expect(result.meta.publishedAt).toBeDefined();
        });

        it("should handle null and undefined values in message", () => {
            const serializer = new DefaultSerializer();
            const data = JSON.stringify({
                message: {
                    nullValue: null,
                    undefinedValue: undefined,
                    stringValue: "test",
                    numberValue: 0,
                    booleanValue: false
                },
                meta: {
                    id: "null-test",
                    publishedAt: Date.now()
                }
            });
            
            const result = serializer.deserialize(data, testProcessorConfig);
            const message = result.message as any;
            expect(message.nullValue).toBeNull();
            expect(message.undefinedValue).toBeUndefined();
            expect(message.stringValue).toBe("test");
            expect(message.numberValue).toBe(0);
            expect(message.booleanValue).toBe(false);
        });

        it("should preserve date strings in messages", () => {
            const serializer = new DefaultSerializer();
            const dateString = "2023-12-25T00:00:00.000Z";
            const data = JSON.stringify({
                message: {
                    dateField: dateString,
                    timestamp: 1703462400000
                },
                meta: {
                    id: "date-test",
                    publishedAt: Date.now()
                }
            });
            
            const result = serializer.deserialize(data, testProcessorConfig);
            const message = result.message as any;
            expect(message.dateField).toBe(dateString);
            expect(message.timestamp).toBe(1703462400000);
        });

        it("should provide typed RunMQMessageValidationError when schema validation fails", () => {
            const serializer = new DefaultSerializer();
            const data = JSON.stringify({
                message: {
                    field1: 123, // Should be string
                    field2: "abc", // Should be number
                    extraField: "not allowed" // Additional property
                },
                meta: {
                    id: "test-123",
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
            
            try {
                serializer.deserialize(data, processorConfigWithSchema);
                fail("Should have thrown ValidationError");
            } catch (error) {
                expect(error).toBeInstanceOf(RunMQSchemaValidationError);
                const validationError = error as RunMQSchemaValidationError;
                expect(validationError.errors).toBeDefined();
                expect(Array.isArray(validationError.errors)).toBe(true);
                expect(validationError.errors!.length).toBeGreaterThan(0);
                
                // Check that all errors are RunMQMessageValidationError type
                validationError.errors!.forEach(err => {
                    expect(err).toHaveProperty('path');
                    expect(err).toHaveProperty('rule');
                    expect(err).toHaveProperty('message');
                    expect(err).toHaveProperty('details');
                    
                    // Path should be relative to message
                    expect(err.path).toMatch(/^\/message/);
                });
                
                // Check specific errors
                const field1Error = validationError.errors!.find(e => e.path === '/message/field1');
                expect(field1Error).toBeDefined();
                expect(field1Error!.rule).toBe('type');
                expect(field1Error!.value).toBe(123);
                
                const field2Error = validationError.errors!.find(e => e.path === '/message/field2');
                expect(field2Error).toBeDefined();
                expect(field2Error!.rule).toBe('type');
                expect(field2Error!.value).toBe("abc");
                
                const extraFieldError = validationError.errors!.find(e => e.path === '/message');
                expect(extraFieldError).toBeDefined();
                expect(extraFieldError!.rule).toBe('additionalProperties');
            }
        });
    });
});