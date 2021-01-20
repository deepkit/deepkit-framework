/*
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */

import { SQLFilterBuilder } from '@deepkit/sql';

export class SQLiteFilterBuilder extends SQLFilterBuilder {
    protected getDeepColumnAccessor(table: string, column: string, path: string) {
        return `json_extract(${table}.${this.quoteId(column)}, ${this.quoteValue('$.' + path)})`;
    }

    protected bindValue(value: any): any {
        if (typeof value === 'boolean') return value ? 1 : 0;
        return super.bindValue(value);
    }
}
