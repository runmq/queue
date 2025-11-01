import {SchemaType} from "@src/types";
import {SchemaValidator} from "@src/core/serializers/deserializer/validation/SchemaValidator";
import {AjvSchemaValidator} from "@src/core/serializers/deserializer/validation/AjvSchemaValidator";
import {RunMQException} from "@src/core/exceptions/RunMQException";
import {Exceptions} from "@src/core/exceptions/Exceptions";

const validatorCache: Map<SchemaType, SchemaValidator<any>> = new Map();

export function getValidator<T>(schemaType: SchemaType): SchemaValidator<any> {
    const cached = validatorCache.get(schemaType);
    if (cached) {
        return cached;
    }

    let validator: SchemaValidator<any>;

    switch (schemaType) {
        case 'ajv':
            validator = new AjvSchemaValidator<T>();
            break;
        default:
            throw new RunMQException(Exceptions.UNSUPPORTED_SCHEMA, {schemaType});
    }

    validatorCache.set(schemaType, validator);
    return validator;
}