/*
 * Deepkit Framework
 * Copyright (c) Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */
import { DeepkitError, stringifyValueWithType } from '@deepkit/core';

// Re-export from core for convenience
export { stringifyValueWithType } from '@deepkit/core';

/**
 * Error thrown during serialization/deserialization when type conversion fails.
 *
 * @example
 * ```typescript
 * throw new SerializationError('Expected string, got number', 'type', 'user.name');
 * // Message: "Serialization failed. user.name: Expected string, got number"
 * ```
 */
export class SerializationError extends DeepkitError {
    constructor(
        public originalMessage: string,
        public errorType: string = '',
        public path: string = '',
    ) {
        super(
            'DK-T200',
            `Serialization failed. ${!path ? '' : (path && path.startsWith('.') ? path.slice(1) : path) + ': '}` +
                originalMessage,
        );
    }

    /**
     * Create a SerializationError from a value and expected type.
     */
    static fromValue(value: unknown, expectedType: string, path: string = ''): SerializationError {
        const valueStr = stringifyValueWithType(value);
        return new SerializationError(`Cannot convert ${valueStr} to ${expectedType}`, 'type', path);
    }
}

/**
 * Represents a dynamic code segment in error paths.
 * Used when the path segment is computed at runtime (e.g., array index in a loop).
 */
export class RuntimeCode {
    constructor(public code: string) {}
}

/**
 * Collapse a path array into a string expression.
 * Static segments are quoted, RuntimeCode segments are inlined.
 *
 * @example
 * ```typescript
 * collapsePath(['user', 'addresses', new RuntimeCode('i'), 'street'])
 * // Returns: '"user"+\'.\'+\"addresses\"+\'.\'+i+\'.\'+\"street\"'
 * ```
 */
export function collapsePath(path: (string | RuntimeCode)[], prefix?: string): string {
    return (
        path
            .filter(v => !!v)
            .map(v => (v instanceof RuntimeCode ? v.code : JSON.stringify(v)))
            .join(`+'.'+`) || `''`
    );
}

/**
 * Get a property name as a string expression for error messages.
 */
export function getPropertyNameString(propertyName?: string | RuntimeCode): string {
    return propertyName ? collapsePath([propertyName]) : '';
}
