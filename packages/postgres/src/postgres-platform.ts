/*
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */

import { Column, DefaultPlatform, Index, isSet, parseType, SqlPlaceholderStrategy, Table } from '@deepkit/sql';
import { postgresSerializer } from './postgres-serializer';
import { ClassSchema, isArray, PostgresOptions, PropertySchema } from '@deepkit/type';
import { PostgresSchemaParser } from './postgres-schema-parser';
import { PostgreSQLFilterBuilder } from './sql-filter-builder';
import { isObject } from '@deepkit/core';
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

export class PostgresPlaceholderStrategy extends SqlPlaceholderStrategy {
    override getPlaceholder() {
        return '$' + (++this.offset);
    }
}

export class PostgresPlatform extends DefaultPlatform {
    protected defaultSqlType = 'text';
    public readonly serializer = postgresSerializer;
    schemaParserType = PostgresSchemaParser;

    placeholderStrategy = PostgresPlaceholderStrategy;

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
        this.addType('enum', 'jsonb');

        this.addType('uuid', 'uuid');
        this.addBinaryType('bytea');
    }

    getAggregateSelect(tableName: string, property: PropertySchema, func: string) {
        if (func === 'group_concat') {
            return `array_to_string(array_agg(${tableName}.${this.quoteIdentifier(property.name)}), ',')`;
        }
        return super.getAggregateSelect(tableName, property, func);
    }

    createSqlFilterBuilder(schema: ClassSchema, tableName: string): PostgreSQLFilterBuilder {
        return new PostgreSQLFilterBuilder(schema, tableName, this.serializer, new this.placeholderStrategy, this.quoteValue.bind(this), this.quoteIdentifier.bind(this));
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
