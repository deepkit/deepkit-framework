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

import {DefaultPlatform, isSet} from './default-platform';
import {postgresSerializer} from '../serializer/postgres-serializer';
import {Column, Index, Table} from '../schema/table';
import {ClassSchema, isArray, PostgresOptions, PropertySchema} from '@deepkit/type';
import {parseType} from '../reverse/schema-parser';
import {PostgresSchemaParser} from '../reverse/postgres-schema-parser';
import {PostgreSQLFilterBuilder} from '../postgres/sql-filter-builder';
import {isObject} from '@deepkit/core';
import sqlstring from 'sqlstring';

function escapeLiteral(value: any): string {
    if (value === null || value === undefined) return 'null';
    if (value instanceof Date) return sqlstring.escape(value);
    if ('number' === typeof value || 'bigint' === typeof value) return String(value);
    if ('string' !== typeof value) return escapeLiteral(String(value));

    let hasBackslash = false;
    let escaped = '\'';

    for (let i = 0; i < value.length; i++) {
        const c = value[i];
        if (c === '\'') {
            escaped += c + c;
        } else if (c === '\\') {
            escaped += c + c;
            hasBackslash = true;
        } else {
            escaped += c;
        }
    }

    escaped += '\'';

    if (hasBackslash) {
        escaped = ' E' + escaped;
    }

    return escaped;
}

export class PostgresPlatform extends DefaultPlatform {
    protected defaultSqlType = 'text';
    public readonly serializer = postgresSerializer;
    schemaParserType = PostgresSchemaParser;

    constructor() {
        super();

        this.addType('number', 'double precision');
        this.addType('date', 'timestamp');
        this.addType('boolean', 'boolean');

        this.addType('class', 'jsonb');
        this.addType('array', 'jsonb');
        this.addType('union', 'jsonb');
        this.addType('partial', 'jsonb');
        this.addType('map', 'jsonb');
        this.addType('patch', 'jsonb');

        this.addType('uuid', 'uuid');
        this.addBinaryType('bytea');
    }

    createSqlFilterBuilder(schema: ClassSchema, tableName: string): PostgreSQLFilterBuilder {
        return new PostgreSQLFilterBuilder(schema, tableName, this.serializer, this.quoteValue.bind(this), this.quoteIdentifier.bind(this));
    }

    quoteValue(value: any): string {
        if (!(value instanceof Date) && (isObject(value) || isArray(value))) return escapeLiteral(JSON.stringify(value));
        if (value instanceof Date) return 'TIMESTAMP ' + sqlstring.escape(value);
        return escapeLiteral(value);
    }

    protected setColumnType(column: Column, typeProperty: PropertySchema) {
        const db = (typeProperty.data['postgres'] || {}) as PostgresOptions;
        if (db.type) {
            parseType(column, db.type);
            return;
        }

        super.setColumnType(column, typeProperty);
    }

    getColumnDDL(column: Column) {
        const ddl: string[] = [];

        ddl.push(this.getIdentifier(column));
        if (column.isAutoIncrement) {
            ddl.push(`SERIAL`);
        } else {
            const foreignKey = column.table.getForeignKeyOfLocalColumn(column);
            if (foreignKey) {
                const [foreignPk] = foreignKey.foreignColumns;
                if (foreignPk.isAutoIncrement) {
                    //the foreignPK has `SERIAL` type, which is basically an INTEGER.
                    ddl.push('INTEGER');
                } else {
                    ddl.push((foreignPk.type || 'INTEGER') + column.getSizeDefinition());
                }
            } else {
                ddl.push((column.type || 'INTEGER') + column.getSizeDefinition());
            }

            ddl.push(column.isNotNull ? this.getNotNullString() : this.getNullString());
            ddl.push(this.getColumnDefaultValueDDL(column));
        }

        return ddl.filter(isSet).join(' ');
    }

    getUniqueDDL(unique: Index): string {
        return `CONSTRAINT ${this.getIdentifier(unique)} UNIQUE (${this.getColumnListDDL(unique.columns)})`;
    }

    getDropIndexDDL(index: Index): string {
        return `DROP CONSTRAINT ${this.getIdentifier(index)}`;
    }

    supportsInlineForeignKey(): boolean {
        return false;
    }

    getAutoIncrement() {
        return '';
    }

    getDropTableDDL(table: Table): string {
        return `DROP TABLE IF EXISTS ${this.getIdentifier(table)} CASCADE`;
    }

    getUseSchemaDDL(table: Table) {
        if (!table.schemaName) return '';
        return `SET search_path TO ${this.quoteIdentifier(table.schemaName)}`;
    }

    getResetSchemaDDL(table: Table): string {
        if (!table.schemaName) return '';
        return `SET search_path TO public`;
    }
}
