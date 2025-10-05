import Ajv, {JSONSchemaType, ValidateFunction} from "ajv";
import {SchemaValidator} from "@src/core/serializers/deserializer/validation/SchemaValidator";

export class AjvSchemaValidator<T> implements SchemaValidator<JSONSchemaType<T>> {
    private readonly ajv: Ajv;
    private lastValidator: ValidateFunction<T> | null = null;

    constructor() {
        this.ajv = new Ajv({
            allErrors: true,
            verbose: true,
            strict: true
        });
    }

    validate(schema: JSONSchemaType<T>, data: unknown): boolean {
        this.lastValidator = this.ajv.compile<T>(schema);
        return this.lastValidator(data);
    }

    getError(): string | null {
        if (!this.lastValidator || !this.lastValidator.errors) {
            return null;
        }
        return JSON.stringify(this.lastValidator.errors);
    }
}