/*
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */
import { DeepkitError } from '@deepkit/core';
import { Changes, PrimaryKeyFields, PrimaryKeyType, ReflectionClass, ValidationErrorItem } from '@deepkit/type';

import { DatabasePersistenceChangeSet } from './database-adapter.js';
import { DatabaseQueryModel } from './query.js';

export interface OrmEntity {}

export type PatchResult<T> = {
    modified: number;
    returning: { [name in keyof T & string]?: T[name][] };
    primaryKeys: PrimaryKeyType<T>[];
};
export type DeleteResult<T> = { modified: number; primaryKeys: PrimaryKeyFields<T>[] };

export class DatabaseError extends DeepkitError {
    constructor(code: string, message: string, options?: { cause?: Error }) {
        super(code, message, options);
    }
}

/**
 * Wraps whatever error into a DatabaseError, if it's not already a DatabaseError.
 */
export function ensureDatabaseError(error: Error | string): Error {
    if ('string' === typeof error) return new DatabaseError('DK-O001', error);
    if (error instanceof DatabaseError) return error;

    return new DatabaseError('DK-O001', error.message, { cause: error });
}

export class DatabaseInsertError extends DatabaseError {
    constructor(
        public readonly entity: ReflectionClass<any>,
        public readonly items: OrmEntity[],
        message: string,
        options?: { cause?: Error },
    ) {
        super('DK-O010', message, options);
    }
}

export class DatabaseUpdateError extends DatabaseError {
    constructor(
        public readonly entity: ReflectionClass<any>,
        public readonly changeSets: DatabasePersistenceChangeSet<any>[],
        message: string,
        options?: { cause?: Error },
    ) {
        super('DK-O011', message, options);
    }
}

export class DatabasePatchError extends DatabaseError {
    constructor(
        public readonly entity: ReflectionClass<any>,
        public readonly query: DatabaseQueryModel<any>,
        public readonly changeSets: Changes<any>,
        message: string,
        options?: { cause?: Error },
    ) {
        super('DK-O012', message, options);
    }
}

export class DatabaseDeleteError extends DatabaseError {
    public readonly query?: DatabaseQueryModel<any>;
    public readonly items?: OrmEntity[];

    constructor(
        public readonly entity: ReflectionClass<any>,
        message: string,
        options?: { cause?: Error },
    ) {
        super('DK-O013', message, options);
    }
}

export class DatabaseValidationError extends DatabaseError {
    constructor(
        public readonly classSchema: ReflectionClass<any>,
        public readonly errors: ValidationErrorItem[],
    ) {
        super(
            'DK-O020',
            `Validation error for class ${classSchema.name || classSchema.getClassName()}:\n${errors.map(v => v.toString()).join(',\n')}`,
        );
    }
}

export class UniqueConstraintFailure extends DatabaseError {
    constructor(message: string, options?: { cause?: Error }) {
        super('DK-O100', message, options);
    }
}
