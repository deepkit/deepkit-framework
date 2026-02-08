/*
 * Deepkit Framework
 * Copyright (c) Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */
import { DeepkitError } from '@deepkit/core';

/**
 * Error class for BSON serialization/deserialization errors.
 *
 * Error codes:
 * - DK-B001: General BSON error
 * - DK-B010: Unknown BSON type encountered
 * - DK-B020: Malformed BSON data (truncated buffer, negative lengths, invalid sizes)
 * - DK-B030: Type conversion failed (BSON type cannot be converted to target TypeScript type)
 * - DK-B040: Union match failed (no union member matched the BSON data)
 * - DK-B050: Circular reference detected during serialization
 * - DK-B060: Type not serializable (TypeScript type has no BSON representation)
 * - DK-B070: Invalid format (malformed ObjectId or UUID string)
 * - DK-B080: Validation failed (encoder validation rejected the data)
 * - DK-B090: Stream error (invalid document size in BSONStreamReader)
 *
 * See ERRORS.md for detailed documentation of each error code.
 */
export class BSONError extends DeepkitError {
    constructor(message: string, code: string = 'DK-B001', options?: { cause?: Error }) {
        super(code, message, options);
    }
}

/**
 * Error thrown when a circular reference is detected during serialization.
 */
export class CircularReferenceError extends BSONError {
    constructor(path: string = '', options?: { cause?: Error }) {
        super(`Circular reference detected${path ? ` at path: ${path}` : ''}`, 'DK-B050', options);
    }
}

/**
 * Error thrown when a type cannot be serialized to BSON.
 */
export class TypeNotSerializableError extends BSONError {
    constructor(typeName: string, options?: { cause?: Error }) {
        super(`Type '${typeName}' cannot be serialized to BSON`, 'DK-B060', options);
    }
}
