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

import {ClassSchema, isArray, resolvePropertyCompilerSchema, Serializer} from '@deepkit/type';
import {isPlainObject} from '@deepkit/core';

type Filter = { [name: string]: any };

export class SQLFilterBuilder {
    constructor(
        protected schema: ClassSchema,
        protected tableName: string,
        protected serializer: Serializer,
        protected quoteValue: (v: any) => string,
        protected quoteId: (v: string) => string
    ) {
    }

    convert(filter: Filter): string {
        return this.conditions(filter, 'AND').trim();
    }

    protected conditionsArray(filters: Filter[], join: 'AND' | 'OR'): string {
        const sql: string[] = [];

        for (const filter of filters) {
            sql.push(this.conditions(filter, 'AND'));
        }

        if (sql.length > 1) return '(' + sql.join(` ${join} `) + ')';
        return sql.join(` ${join} `);
    }

    protected condition(fieldName: string | undefined, value: any, comparison: 'eq' | 'gt' | 'gte' | 'in' | 'lt' | 'lte' | 'ne' | 'nin' | string): string {
        if (fieldName === undefined) {
            throw new Error('No comparison operators at root level allowed');
        }

        if (isPlainObject(value)) {
            return this.conditions(value, fieldName);
        }

        let cmpSign: string;

        if (comparison === 'eq') cmpSign = '=';
        else if (comparison === 'gt') cmpSign = '>';
        else if (comparison === 'gte') cmpSign = '>=';
        else if (comparison === 'lt') cmpSign = '<';
        else if (comparison === 'lte') cmpSign = '<=';
        else if (comparison === 'ne') cmpSign = '!=';
        else if (comparison === 'in') cmpSign = 'IN';
        else if (comparison === 'nin') cmpSign = 'NOT IN';
        else throw new Error(`Comparator ${comparison} not supported.`);

        if (value[0] !== '$') {
            const property = resolvePropertyCompilerSchema(this.schema, fieldName);
            if (!property.isArray && (comparison === 'in' || comparison === 'nin') && isArray(value)) {
                value = value.map(v => this.quoteValue(this.serializer.serializeProperty(property, v)));
            } else {
                value = this.quoteValue(this.serializer.serializeProperty(property, value));
            }
        }

        let rvalue = value;
        if (value[0] === '$') rvalue = `${this.tableName}.${this.quoteId(value.substr(1))}`;
        if (comparison === 'in' || comparison === 'nin') rvalue = '(' + rvalue + ')';

        if (fieldName.includes('.')) {
            const [column, path] = this.splitDeepFieldPath(fieldName);
            return `${this.getDeepColumnAccessor(this.tableName, column, path)} ${cmpSign} ${rvalue}`;
        }

        return `${this.tableName}.${this.quoteId(fieldName)} ${cmpSign} ${rvalue}`;
    }

    protected getDeepColumnAccessor(table: string, column: string, path: string) {
        return `${table}.${this.quoteId(column)}->${this.quoteValue('$.' + path)}`;
    }

    protected splitDeepFieldPath(path: string): [column: string, path: string] {
        const pos = path.indexOf('.');
        if (pos === -1) return [path, ''];
        return [path.substr(0, pos), path.substr(pos + 1)];
    }

    protected conditions(filter: Filter, fieldName?: string): string {
        const sql: string[] = [];

        for (const i in filter) {
            if (!filter.hasOwnProperty(i)) continue;

            if (i === '$or') return this.conditionsArray(filter[i], 'OR');
            if (i === '$and') return this.conditionsArray(filter[i], 'AND');
            if (i === '$not') return `NOT ` + this.conditionsArray(filter[i], 'AND');

            if (i === '$exists') sql.push(this.quoteValue(this.schema.hasProperty(i)));
            else if (i[0] === '$') sql.push(this.condition(fieldName, filter[i], i.substr(1)));
            else sql.push(this.condition(i, filter[i], 'eq'));
        }

        if (sql.length > 1) return '(' + sql.join(` AND `) + ')';
        return sql.join(` AND `);
    }
}
