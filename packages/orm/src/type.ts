/*
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */

import { ClassSchema, ExtractPrimaryKeyType, ValidationFailedItem } from '@deepkit/type';
import { CustomError } from '@deepkit/core';

export interface Entity {
}

export type PatchResult<T> = { modified: number, returning: { [name in keyof T & string]?: T[name][] }, primaryKeys: ExtractPrimaryKeyType<T>[] };
export type DeleteResult<T> = { modified: number, primaryKeys: ExtractPrimaryKeyType<T>[] };


export class DatabaseValidationError extends CustomError {
    constructor(
        public readonly classSchema: ClassSchema,
        public readonly errors: ValidationFailedItem[],
    ) {
        super(`Validation error for class ${classSchema.name || classSchema.getClassName()}:\n${errors.map(v => v.toString()).join(',\n')}`);
    }
}
