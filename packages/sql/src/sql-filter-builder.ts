/*
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */

import { isArray, isPlainObject } from '@deepkit/core';
import { ClassSchema, resolvePropertySchema, Serializer } from '@deepkit/type';
import { SqlPlaceholderStrategy } from './platform/default-platform';

type Filter = { [name: string]: any };

export class SQLFilterBuilder {
    public params: any[] = [];

    constructor(
        protected schema: ClassSchema,
        protected tableName: string,
        protected serializer: Serializer,
        public placeholderStrategy: SqlPlaceholderStrategy,
        protected quoteValue: (v: any) => string,
        protected quoteId: (v: string) => string
    ) {
    }

    isNull() {
        return 'IS NULL';
    }

    regexpComparator() {
        return 'REGEXP';
    }

    convert(filter: Filter): string {
        return this.conditions(filter, 'AND').trim();
    }

    /**
     * Normalizes values necessary for the conection driver to bind parameters for prepared statements.
     * E.g. SQLite does not support boolean, so we convert boolean to number.
     */
    protected bindValue(value: any): any {
        if (value === undefined) return null; //no SQL driver supports undefined
        if (value instanceof RegExp) return value.source;
        return value;
    }

    protected conditionsArray(filters: Filter[], join: 'AND' | 'OR'): string {
        const sql: string[] = [];

        for (const filter of filters) {
            sql.push(this.conditions(filter, 'AND'));
        }

        if (sql.length > 1) return '(' + sql.join(` ${join} `) + ')';
        return sql.join(` ${join} `);
    }

    protected quoteIdWithTable(id: string): string {
        if (this.tableName) return `${this.tableName}.${this.quoteId(id)}`;
        return `${this.quoteId(id)}`;
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
        else if (comparison === 'neq') cmpSign = '!=';
        else if (comparison === 'gt') cmpSign = '>';
        else if (comparison === 'gte') cmpSign = '>=';
        else if (comparison === 'lt') cmpSign = '<';
        else if (comparison === 'lte') cmpSign = '<=';
        else if (comparison === 'ne') cmpSign = '!=';
        else if (comparison === 'in') cmpSign = 'IN';
        else if (comparison === 'nin') cmpSign = 'NOT IN';
        else if (comparison === 'regex') cmpSign = this.regexpComparator();
        else throw new Error(`Comparator ${comparison} not supported.`);

        const isReference = 'string' === typeof value && value[0] === '$';
        let rvalue = '';
        if (isReference) {
            rvalue = `${this.quoteIdWithTable(value.substr(1))}`;
        } else {
            if (value === undefined || value === null) {
                cmpSign = this.isNull();
                rvalue = '';
            } else {
                const property = resolvePropertySchema(this.schema, fieldName);

                if (comparison === 'in' || comparison === 'nin') {
                    if (isArray(value)) {
                        const params: string[] = [];
                        for (let item of value) {
                            params.push(this.placeholderStrategy.getPlaceholder());

                            if (!property.isReference && !property.backReference && (property.type === 'class' || property.type === 'map' || property.type === 'array')) {
                                item = JSON.stringify(item);
                            }
                            this.params.push(this.bindValue(item));
                        }
                        rvalue = params.length ? `(${params.join(', ')})` : '(null)';
                    }
                } else {
                    rvalue = this.placeholderStrategy.getPlaceholder();

                    if (!property.isReference && !property.backReference && (property.type === 'class' || property.type === 'map' || property.type === 'array')) {
                        value = JSON.stringify(value);
                    }
                    this.params.push(this.bindValue(value));
                }
            }
        }

        // if (comparison === 'in' || comparison === 'nin') rvalue = '(' + rvalue + ')';

        if (fieldName.includes('.')) {
            const [column, path] = this.splitDeepFieldPath(fieldName);
            return `${this.getDeepColumnAccessor(this.tableName, column, path)} ${cmpSign} ${rvalue}`;
        }

        return `${this.quoteIdWithTable(fieldName)} ${cmpSign} ${rvalue}`;
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
