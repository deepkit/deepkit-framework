/*
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */

import { Changes, PrimaryKeyFields, PrimaryKeyType, ReflectionClass, ValidationErrorItem } from '@deepkit/type';
import { CustomError } from '@deepkit/core';
import { DatabasePersistenceChangeSet } from './database-adapter.js';
import { DatabaseQueryModel } from './query.js';

export interface OrmEntity {
}

export type PatchResult<T> = { modified: number, returning: { [name in keyof T & string]?: T[name][] }, primaryKeys: PrimaryKeyType<T>[] };
export type DeleteResult<T> = { modified: number, primaryKeys: PrimaryKeyFields<T>[] };

export class DatabaseError extends CustomError {
}

/**
 * Wraps whatever error into a DatabaseError, if it's not already a DatabaseError.
 */
export function ensureDatabaseError(error: Error | string): Error {
    if ('string' === typeof error) return new DatabaseError(error);
    if (error instanceof DatabaseError) return error;

    return new DatabaseError(error.message, { cause: error });
}

export class DatabaseInsertError extends DatabaseError {
    constructor(
        public readonly entity: ReflectionClass<any>,
        public readonly items: OrmEntity[],
        ...args: ConstructorParameters<typeof DatabaseError>
    ) {
        super(...args);
    }
}

export class DatabaseUpdateError extends DatabaseError {
    constructor(
        public readonly entity: ReflectionClass<any>,
        public readonly changeSets: DatabasePersistenceChangeSet<any>[],
        ...args: ConstructorParameters<typeof DatabaseError>
    ) {
        super(...args);
    }
}

export class DatabasePatchError extends DatabaseError {
    constructor(
        public readonly entity: ReflectionClass<any>,
        public readonly query: DatabaseQueryModel<any>,
        public readonly changeSets: Changes<any>,
        ...args: ConstructorParameters<typeof DatabaseError>
    ) {
        super(...args);
    }
}

export class DatabaseDeleteError extends DatabaseError {
    public readonly query?: DatabaseQueryModel<any>;
    public readonly items?: OrmEntity[];

    constructor(
        public readonly entity: ReflectionClass<any>,
        ...args: ConstructorParameters<typeof DatabaseError>
    ) {
        super(...args);
    }
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
}
