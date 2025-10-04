import {SchemaType} from "@src/types";
import {SchemaValidator} from "@src/core/serializers/validation/SchemaValidator";
import {AjvSchemaValidator} from "@src/core/serializers/validation/AjvSchemaValidator";

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
            throw new Error(`Unsupported schema type: ${schemaType}`);
    }
    
    validatorCache.set(schemaType, validator);
    return validator;
}