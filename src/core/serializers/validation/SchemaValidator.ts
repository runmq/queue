import {RunMQMessageValidationError} from "@src/core/serializers/validation/RunMQMessageValidationError";

export interface SchemaValidator<T> {
    validate(schema: T, data: unknown): boolean;
    getErrors(): RunMQMessageValidationError[] | null;
}