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

export class PostgreSQLFilterBuilder extends SQLFilterBuilder {
    regexpComparator(lvalue: string, value: RegExp) {
        if (value.flags.includes('i')) return `${lvalue} ~* ${this.bindParam(value.source)}`;
        return `${lvalue} ~ ${this.bindParam(value.source)}`;
    }
}
