import {ClassSchema, ExtractPrimaryKeyType, ValidationFailedItem} from '@deepkit/type';
import {CustomError} from '@deepkit/core';

export interface Entity {
}

export type PatchResult<T, K extends (keyof T) | never = never> = { modified: number, returning: { [name in K]: T[name][] }, primaryKeys: ExtractPrimaryKeyType<T>[] };
export type DeleteResult<T> = { modified: number, primaryKeys: ExtractPrimaryKeyType<T>[] };


export class DatabaseValidationError extends CustomError {
    constructor(
        public readonly classSchema: ClassSchema,
        public readonly errors: ValidationFailedItem[],
    ) {
        super(`Validation error for class ${classSchema.getName()}:\n${errors.map(v => v.toString()).join(',\n')}`);
    }
}
