export interface SchemaValidator<T> {
    validate(schema: T, data: unknown): boolean;
    getError(): string | null;
}