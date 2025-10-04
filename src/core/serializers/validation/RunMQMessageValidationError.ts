export interface RunMQMessageValidationError {
    /**
     * The path to the property that failed validation
     * e.g., "/message/user/email" or "/meta/id"
     */
    path: string;
    
    /**
     * The validation rule that failed
     * e.g., "type", "required", "pattern", "minimum"
     */
    rule: string;
    
    /**
     * Human-readable error message
     */
    message: string;
    
    /**
     * The actual value that failed validation
     */
    value?: unknown;
    
    /**
     * Additional details about the validation failure
     */
    details?: {
        /**
         * Expected value or constraint
         */
        expected?: unknown;
        
        /**
         * Schema definition that failed
         */
        schema?: unknown;
        
        /**
         * Any additional context
         */
        [key: string]: unknown;
    };
}