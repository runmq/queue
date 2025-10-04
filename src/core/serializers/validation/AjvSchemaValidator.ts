import Ajv, {JSONSchemaType, ValidateFunction, ErrorObject} from "ajv";
import {SchemaValidator} from "@src/core/serializers/validation/SchemaValidator";
import {RunMQMessageValidationError} from "@src/core/serializers/validation/RunMQMessageValidationError";

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

    getErrors(): RunMQMessageValidationError[] | null {
        if (!this.lastValidator || !this.lastValidator.errors) {
            return null;
        }
        
        return this.lastValidator.errors.map(error => this.mapAjvErrorToRunMQError(error));
    }
    
    private mapAjvErrorToRunMQError(ajvError: ErrorObject): RunMQMessageValidationError {
        const path = `/message${ajvError.instancePath || ''}`;
        const rule = ajvError.keyword;
        
        let message = ajvError.message || 'Validation failed';
        if (ajvError.instancePath) {
            message = `message${ajvError.instancePath} ${message}`;
        } else {
            message = `message ${message}`;
        }
        const value = ajvError.data;

        const details: RunMQMessageValidationError['details'] = {
            schema: ajvError.schemaPath,
        };
        
        if (ajvError.params) {
            Object.entries(ajvError.params).forEach(([key, val]) => {
                details[key] = val;
            });
        }
        
        switch (rule) {
            case 'type':
                details.expected = ajvError.schema;
                break;
            case 'enum':
                details.expected = ajvError.schema;
                break;
            case 'pattern':
                details.expected = ajvError.schema;
                break;
            case 'minimum':
            case 'maximum':
            case 'minLength':
            case 'maxLength':
            case 'minItems':
            case 'maxItems':
                details.expected = ajvError.schema;
                break;
        }
        
        return {
            path,
            rule,
            message,
            value,
            details
        };
    }
}