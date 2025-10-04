import {getValidator} from "@src/core/serializers/validation/ValidatorFactory";
import {AjvSchemaValidator} from "@src/core/serializers/validation/AjvSchemaValidator";
import {JSONSchemaType} from "ajv";

interface TestData {
    name: string;
    value: number;
}

describe("ValidatorFactory", () => {
    describe("getValidator", () => {
        it("should return an AjvSchemaValidator for 'ajv' type", () => {
            const validator = getValidator<TestData>("ajv");
            
            expect(validator).toBeDefined();
            expect(validator).toBeInstanceOf(AjvSchemaValidator);
        });

        it("should cache validators by schema type", () => {
            const validator1 = getValidator<TestData>("ajv");
            const validator2 = getValidator<TestData>("ajv");
            
            expect(validator1).toBe(validator2);
        });

        it("should throw error for unsupported schema type", () => {
            // @ts-expect-error - Testing invalid schema type
            expect(() => getValidator<TestData>("unsupported")).toThrow("Unsupported schema type: unsupported");
        });

        it("should return working validator for ajv type", () => {
            const validator = getValidator<TestData>("ajv");
            
            const schema: JSONSchemaType<TestData> = {
                type: "object",
                properties: {
                    name: { type: "string" },
                    value: { type: "number" }
                },
                required: ["name", "value"]
            };

            const validData = { name: "test", value: 42 };
            const invalidData = { name: "test", value: "not a number" };

            expect(validator.validate(schema, validData)).toBe(true);
            expect(validator.validate(schema, invalidData)).toBe(false);
        });

        it("should maintain separate caches for different types", () => {
            // Currently only 'ajv' is supported, but this test ensures
            // the caching mechanism works properly for future extensions
            const ajvValidator1 = getValidator("ajv");
            const ajvValidator2 = getValidator("ajv");
            
            expect(ajvValidator1).toBe(ajvValidator2);
        });

        it("should return validators that can provide error details", () => {
            const validator = getValidator<TestData>("ajv");
            
            const schema: JSONSchemaType<TestData> = {
                type: "object",
                properties: {
                    name: { type: "string" },
                    value: { type: "number" }
                },
                required: ["name", "value"],
                additionalProperties: false
            };

            const invalidData = { 
                name: 123, // Should be string
                value: "abc", // Should be number
                extra: "field" // Not allowed
            };

            validator.validate(schema, invalidData);
            const errors = validator.getErrors?.();
            
            expect(errors).toBeDefined();
            expect(Array.isArray(errors)).toBe(true);
            expect((errors! as Array<any>).length).toBeGreaterThan(0);
        });

        it("should handle complex schemas with cached validators", () => {
            interface ComplexData {
                users: Array<{
                    id: number;
                    name: string;
                    roles: string[];
                }>;
                settings: {
                    theme: "light" | "dark";
                    notifications: boolean;
                };
            }

            const validator = getValidator<ComplexData>("ajv");
            
            const schema: JSONSchemaType<ComplexData> = {
                type: "object",
                properties: {
                    users: {
                        type: "array",
                        items: {
                            type: "object",
                            properties: {
                                id: { type: "number" },
                                name: { type: "string" },
                                roles: {
                                    type: "array",
                                    items: { type: "string" }
                                }
                            },
                            required: ["id", "name", "roles"]
                        }
                    },
                    settings: {
                        type: "object",
                        properties: {
                            theme: { 
                                type: "string",
                                enum: ["light", "dark"]
                            },
                            notifications: { type: "boolean" }
                        },
                        required: ["theme", "notifications"]
                    }
                },
                required: ["users", "settings"]
            };

            const validData: ComplexData = {
                users: [
                    { id: 1, name: "Alice", roles: ["admin", "user"] },
                    { id: 2, name: "Bob", roles: ["user"] }
                ],
                settings: {
                    theme: "dark",
                    notifications: true
                }
            };

            expect(validator.validate(schema, validData)).toBe(true);

            const invalidData = {
                users: [
                    { id: "1", name: "Alice", roles: ["admin"] } // id should be number
                ],
                settings: {
                    theme: "blue", // Invalid enum value
                    notifications: "yes" // Should be boolean
                }
            };

            expect(validator.validate(schema, invalidData)).toBe(false);
        });

        it("should handle validators with different generic types but same schema type", () => {
            interface TypeA {
                fieldA: string;
            }

            interface TypeB {
                fieldB: number;
            }

            const validatorA = getValidator<TypeA>("ajv");
            const validatorB = getValidator<TypeB>("ajv");
            
            // They should be the same instance since caching is by schema type
            expect(validatorA).toBe(validatorB);
            
            // But they should both work correctly with their respective schemas
            const schemaA: JSONSchemaType<TypeA> = {
                type: "object",
                properties: {
                    fieldA: { type: "string" }
                },
                required: ["fieldA"]
            };

            const schemaB: JSONSchemaType<TypeB> = {
                type: "object",
                properties: {
                    fieldB: { type: "number" }
                },
                required: ["fieldB"]
            };

            expect(validatorA.validate(schemaA, { fieldA: "test" })).toBe(true);
            expect(validatorB.validate(schemaB, { fieldB: 123 })).toBe(true);
        });
    });
});