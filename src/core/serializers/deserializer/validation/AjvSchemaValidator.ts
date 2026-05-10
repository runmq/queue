import Ajv, {JSONSchemaType, ValidateFunction} from "ajv";
import {SchemaValidator} from "@src/core/serializers/deserializer/validation/SchemaValidator";

export class AjvSchemaValidator<T> implements SchemaValidator<JSONSchemaType<T>> {
    private readonly ajv: Ajv;
    private lastValidator: ValidateFunction<T> | null = null;
    /**
     * Cache of compiled validators, keyed by schema identity.
     *
     * `ajv.compile()` codegens an optimized JS function from the schema
     * (typically 2-10ms for non-trivial schemas). Without this cache the
     * compile would run on every message — at high throughput it dominates
     * CPU usage.
     *
     * WeakMap so we don't pin schemas in memory if a processor is removed.
     */
    private readonly compiled: WeakMap<object, ValidateFunction<T>> = new WeakMap();

    constructor() {
        this.ajv = new Ajv({
            allErrors: true,
            verbose: true,
            strict: true
        });
    }

    validate(schema: JSONSchemaType<T>, data: unknown): boolean {
        const key = schema as unknown as object;
        let validator = this.compiled.get(key);
        if (!validator) {
            validator = this.ajv.compile<T>(schema);
            this.compiled.set(key, validator);
        }
        this.lastValidator = validator;
        return validator(data);
    }

    getError(): string | null {
        if (!this.lastValidator || !this.lastValidator.errors) {
            return null;
        }
        return JSON.stringify(this.lastValidator.errors);
    }
}
