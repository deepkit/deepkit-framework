/*
 * Deepkit Framework
 * Copyright (C) 2020 Deepkit UG
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

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
