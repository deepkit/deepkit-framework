/*
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */

import { PrimaryKeyFields, PrimaryKeyType, ReflectionClass, ValidationErrorItem } from '@deepkit/type';
import { CustomError } from '@deepkit/core';

export interface OrmEntity {
}

export type PatchResult<T> = { modified: number, returning: { [name in keyof T & string]?: T[name][] }, primaryKeys: PrimaryKeyType<T>[] };
export type DeleteResult<T> = { modified: number, primaryKeys: PrimaryKeyFields<T>[] };

export class DatabaseError extends CustomError {
}

export class DatabaseValidationError extends DatabaseError {
    constructor(
        public readonly classSchema: ReflectionClass<any>,
        public readonly errors: ValidationErrorItem[],
    ) {
        super(`Validation error for class ${classSchema.name || classSchema.getClassName()}:\n${errors.map(v => v.toString()).join(',\n')}`);
    }
}

export class UniqueConstraintFailure extends DatabaseError {
    constructor(
        // public readonly classSchema: ClassSchema,
        // public readonly property: PropertySchema,
    ) {
        super('Unique constraint failure');
        // super(`Unique constraint failure for ${classSchema.getClassName()}.${property.name}`);
    }
}
