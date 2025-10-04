import {AjvSchemaValidator} from "@src/core/serializers/validation/AjvSchemaValidator";
import {RunMQMessageValidationError} from "@src/core/serializers/validation/RunMQMessageValidationError";
import {JSONSchemaType} from "ajv";

interface TestData {
    name: string;
    age: number;
    email?: string;
}

describe("AjvSchemaValidator", () => {
    let validator: AjvSchemaValidator<TestData>;

    beforeEach(() => {
        validator = new AjvSchemaValidator<TestData>();
    });

    describe("validate", () => {
        const validSchema: JSONSchemaType<TestData> = {
            type: "object",
            properties: {
                name: { type: "string" },
                age: { type: "number" },
                email: { type: "string", nullable: true }
            },
            required: ["name", "age"],
            additionalProperties: false
        };

        it("should return true for valid data", () => {
            const validData = {
                name: "John Doe",
                age: 30
            };

            const result = validator.validate(validSchema, validData);
            expect(result).toBe(true);
        });

        it("should return true for valid data with optional fields", () => {
            const validData = {
                name: "Jane Smith",
                age: 25,
                email: "jane@example.com"
            };

            const result = validator.validate(validSchema, validData);
            expect(result).toBe(true);
        });

        it("should return false for missing required fields", () => {
            const invalidData = {
                name: "John Doe"
                // Missing age
            };

            const result = validator.validate(validSchema, invalidData);
            expect(result).toBe(false);
        });

        it("should return false for wrong type", () => {
            const invalidData = {
                name: "John Doe",
                age: "thirty" // Should be number
            };

            const result = validator.validate(validSchema, invalidData);
            expect(result).toBe(false);
        });

        it("should return false for additional properties when not allowed", () => {
            const invalidData = {
                name: "John Doe",
                age: 30,
                extraField: "not allowed"
            };

            const result = validator.validate(validSchema, invalidData);
            expect(result).toBe(false);
        });

        it("should handle complex nested schemas", () => {
            interface NestedData {
                user: {
                    profile: {
                        name: string;
                        settings: {
                            theme: "dark" | "light";
                            notifications: boolean;
                        };
                    };
                    roles: string[];
                };
            }

            const nestedValidator = new AjvSchemaValidator<NestedData>();
            const nestedSchema: JSONSchemaType<NestedData> = {
                type: "object",
                properties: {
                    user: {
                        type: "object",
                        properties: {
                            profile: {
                                type: "object",
                                properties: {
                                    name: { type: "string" },
                                    settings: {
                                        type: "object",
                                        properties: {
                                            theme: { type: "string", enum: ["dark", "light"] },
                                            notifications: { type: "boolean" }
                                        },
                                        required: ["theme", "notifications"]
                                    }
                                },
                                required: ["name", "settings"]
                            },
                            roles: {
                                type: "array",
                                items: { type: "string" }
                            }
                        },
                        required: ["profile", "roles"]
                    }
                },
                required: ["user"]
            };

            const validNestedData = {
                user: {
                    profile: {
                        name: "Admin User",
                        settings: {
                            theme: "dark" as const,
                            notifications: true
                        }
                    },
                    roles: ["admin", "user"]
                }
            };

            const result = nestedValidator.validate(nestedSchema, validNestedData);
            expect(result).toBe(true);
        });

        it("should handle array validation", () => {
            interface ArrayData {
                items: number[];
                tags: string[];
            }

            const arrayValidator = new AjvSchemaValidator<ArrayData>();
            const arraySchema: JSONSchemaType<ArrayData> = {
                type: "object",
                properties: {
                    items: {
                        type: "array",
                        items: { type: "number" },
                        minItems: 1,
                        maxItems: 5
                    },
                    tags: {
                        type: "array",
                        items: { type: "string" },
                        uniqueItems: true
                    }
                },
                required: ["items", "tags"]
            };

            const validData = {
                items: [1, 2, 3],
                tags: ["tag1", "tag2", "tag3"]
            };

            expect(arrayValidator.validate(arraySchema, validData)).toBe(true);

            const invalidData = {
                items: [1, 2, 3, 4, 5, 6], // Too many items
                tags: ["tag1", "tag1", "tag2"] // Duplicate items
            };

            expect(arrayValidator.validate(arraySchema, invalidData)).toBe(false);
        });

        it("should handle pattern validation", () => {
            interface PatternData {
                email: string;
                phone: string;
            }

            const patternValidator = new AjvSchemaValidator<PatternData>();
            const patternSchema: JSONSchemaType<PatternData> = {
                type: "object",
                properties: {
                    email: {
                        type: "string",
                        pattern: "^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$"
                    },
                    phone: {
                        type: "string",
                        pattern: "^\\+?[1-9]\\d{1,14}$"
                    }
                },
                required: ["email", "phone"]
            };

            const validData = {
                email: "test@example.com",
                phone: "+1234567890"
            };

            expect(patternValidator.validate(patternSchema, validData)).toBe(true);

            const invalidData = {
                email: "invalid-email",
                phone: "abc123"
            };

            expect(patternValidator.validate(patternSchema, invalidData)).toBe(false);
        });

        it("should handle numeric constraints", () => {
            interface NumericData {
                price: number;
                quantity: number;
                rating: number;
            }

            const numericValidator = new AjvSchemaValidator<NumericData>();
            const numericSchema: JSONSchemaType<NumericData> = {
                type: "object",
                properties: {
                    price: {
                        type: "number",
                        minimum: 0,
                        exclusiveMaximum: 1000000
                    },
                    quantity: {
                        type: "integer",
                        minimum: 1,
                        maximum: 100
                    },
                    rating: {
                        type: "number",
                        minimum: 0,
                        maximum: 5,
                        multipleOf: 0.5
                    }
                },
                required: ["price", "quantity", "rating"]
            };

            const validData = {
                price: 99.99,
                quantity: 50,
                rating: 4.5
            };

            expect(numericValidator.validate(numericSchema, validData)).toBe(true);

            const invalidData = {
                price: 1000000, // Equal to exclusiveMaximum
                quantity: 150, // Exceeds maximum
                rating: 4.3 // Not multiple of 0.5
            };

            expect(numericValidator.validate(numericSchema, invalidData)).toBe(false);
        });
    });

    describe("getErrors", () => {
        it("should return null when no validation has been performed", () => {
            const errors = validator.getErrors();
            expect(errors).toBeNull();
        });

        it("should return null after successful validation", () => {
            const schema: JSONSchemaType<TestData> = {
                type: "object",
                properties: {
                    name: { type: "string" },
                    age: { type: "number" },
                    email: { type: "string", nullable: true }
                },
                required: ["name", "age"]
            };

            const validData = {
                name: "John",
                age: 30
            };

            validator.validate(schema, validData);
            const errors = validator.getErrors();
            expect(errors).toBeNull();
        });

        it("should return error details after failed validation", () => {
            const schema: JSONSchemaType<TestData> = {
                type: "object",
                properties: {
                    name: { type: "string" },
                    age: { type: "number" },
                    email: { type: "string", nullable: true }
                },
                required: ["name", "age"],
                additionalProperties: false
            };

            const invalidData = {
                name: "John",
                age: "invalid", // Should be number
                extraField: "not allowed"
            };

            validator.validate(schema, invalidData);
            const errors = validator.getErrors();
            
            expect(errors).toBeDefined();
            expect(Array.isArray(errors)).toBe(true);
            expect(errors!.length).toBeGreaterThan(0);
            
            // Check that errors are RunMQMessageValidationError type
            errors!.forEach(error => {
                expect(error).toHaveProperty('path');
                expect(error).toHaveProperty('rule');
                expect(error).toHaveProperty('message');
                expect(error).toHaveProperty('details');
            });
            
            // Check specific errors
            const typeError = errors!.find(e => e.rule === 'type');
            expect(typeError).toBeDefined();
            expect(typeError!.path).toBe('/message/age');
            expect(typeError!.message).toContain('must be number');
            expect(typeError!.value).toBe('invalid');
            
            const additionalPropError = errors!.find(e => e.rule === 'additionalProperties');
            expect(additionalPropError).toBeDefined();
            expect(additionalPropError!.path).toBe('/message');
            expect(additionalPropError!.message).toContain('must NOT have additional properties');
        });

        it("should return detailed errors for nested validation failures", () => {
            interface NestedData {
                user: {
                    name: string;
                    age: number;
                };
            }

            const nestedValidator = new AjvSchemaValidator<NestedData>();
            const schema: JSONSchemaType<NestedData> = {
                type: "object",
                properties: {
                    user: {
                        type: "object",
                        properties: {
                            name: { type: "string" },
                            age: { type: "number" }
                        },
                        required: ["name", "age"]
                    }
                },
                required: ["user"]
            };

            const invalidData = {
                user: {
                    name: 123, // Should be string
                    age: "twenty" // Should be number
                }
            };

            nestedValidator.validate(schema, invalidData);
            const errors = nestedValidator.getErrors();
            
            expect(errors).toBeDefined();
            expect(errors!.length).toBe(2);
            
            // Check that error paths are correct with /message prefix
            const nameError = errors!.find(e => e.path === '/message/user/name');
            expect(nameError).toBeDefined();
            expect(nameError!.rule).toBe('type');
            expect(nameError!.value).toBe(123);
            
            const ageError = errors!.find(e => e.path === '/message/user/age');
            expect(ageError).toBeDefined();
            expect(ageError!.rule).toBe('type');
            expect(ageError!.value).toBe('twenty');
        });

        it("should clear previous errors on new validation", () => {
            const schema: JSONSchemaType<TestData> = {
                type: "object",
                properties: {
                    name: { type: "string" },
                    age: { type: "number" },
                    email: { type: "string", nullable: true }
                },
                required: ["name", "age"]
            };

            // First validation - should fail
            const invalidData = { name: "John" };
            validator.validate(schema, invalidData);
            const firstErrors = validator.getErrors();
            expect(firstErrors).toBeDefined();
            expect(firstErrors!.length).toBeGreaterThan(0);

            // Second validation - should pass
            const validData = { name: "John", age: 30 };
            validator.validate(schema, validData);
            expect(validator.getErrors()).toBeNull();
        });

        it("should provide detailed error information for complex validation failures", () => {
            interface ComplexData {
                email: string;
                age: number;
                tags: string[];
            }

            const complexValidator = new AjvSchemaValidator<ComplexData>();
            const schema: JSONSchemaType<ComplexData> = {
                type: "object",
                properties: {
                    email: {
                        type: "string",
                        pattern: "^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$"
                    },
                    age: {
                        type: "number",
                        minimum: 18,
                        maximum: 100
                    },
                    tags: {
                        type: "array",
                        items: { type: "string" },
                        minItems: 1,
                        maxItems: 5,
                        uniqueItems: true
                    }
                },
                required: ["email", "age", "tags"]
            };

            const invalidData = {
                email: "invalid-email",
                age: 150,
                tags: ["tag1", "tag1", "tag2", "tag3", "tag4", "tag5", "tag6"]
            };

            complexValidator.validate(schema, invalidData);
            const errors = complexValidator.getErrors() as RunMQMessageValidationError[];
            
            expect(errors).toBeDefined();
            expect(errors.length).toBeGreaterThan(0);

            // Check email pattern error
            const emailError = errors.find(e => e.path === '/message/email');
            expect(emailError).toBeDefined();
            expect(emailError!.rule).toBe('pattern');
            expect(emailError!.details?.expected).toBeDefined();

            // Check age maximum error
            const ageError = errors.find(e => e.path === '/message/age');
            expect(ageError).toBeDefined();
            expect(ageError!.rule).toBe('maximum');
            expect(ageError!.details?.expected).toBe(100);
            expect(ageError!.value).toBe(150);

            // Check array errors
            const arrayErrors = errors.filter(e => e.path.startsWith('/message/tags'));
            expect(arrayErrors.length).toBeGreaterThan(0);
        });
    });
});