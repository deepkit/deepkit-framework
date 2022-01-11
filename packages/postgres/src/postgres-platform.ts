/*
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */

import { Column, DefaultPlatform, IndexModel, isSet, SqlPlaceholderStrategy, Table } from '@deepkit/sql';
import { postgresSerializer } from './postgres-serializer';
import { isUUIDType, ReflectionClass, ReflectionKind, ReflectionProperty, Serializer, TypeNumberBrand } from '@deepkit/type';
import { PostgresSchemaParser } from './postgres-schema-parser';
import { PostgreSQLFilterBuilder } from './sql-filter-builder';
import { isArray, isObject } from '@deepkit/core';
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
    protected override defaultSqlType = 'text';
    protected override annotationId = 'postgres';
    public override readonly serializer: Serializer = postgresSerializer;
    override schemaParserType = PostgresSchemaParser;

    override placeholderStrategy = PostgresPlaceholderStrategy;

    constructor() {
        super();

        this.addType(ReflectionKind.number, 'double precision');
        this.addType(ReflectionKind.boolean, 'boolean');

        this.addType(ReflectionKind.class, 'jsonb');
        this.addType(ReflectionKind.array, 'jsonb');
        this.addType(ReflectionKind.union, 'jsonb');

        this.addType(v => v.kind === ReflectionKind.enum && v.indexType.kind === ReflectionKind.number, 'integer');
        this.addType(v => v.kind === ReflectionKind.enum && v.indexType.kind === ReflectionKind.string, 'text');
        this.addType(v => v.kind === ReflectionKind.enum && v.indexType.kind === ReflectionKind.union, 'jsonb');

        this.addType(ReflectionKind.bigint, 'bigint');
        this.addType(type => type.kind === ReflectionKind.number && type.brand === TypeNumberBrand.integer, 'integer');
        this.addType(type => type.kind === ReflectionKind.number && type.brand === TypeNumberBrand.int8, 'smallint');
        this.addType(type => type.kind === ReflectionKind.number && type.brand === TypeNumberBrand.uint8, 'smallint');
        this.addType(type => type.kind === ReflectionKind.number && type.brand === TypeNumberBrand.int16, 'smallint');
        this.addType(type => type.kind === ReflectionKind.number && type.brand === TypeNumberBrand.uint16, 'smallint');
        this.addType(type => type.kind === ReflectionKind.number && type.brand === TypeNumberBrand.int32, 'integer');
        this.addType(type => type.kind === ReflectionKind.number && type.brand === TypeNumberBrand.uint32, 'integer');
        this.addType(type => type.kind === ReflectionKind.number && type.brand === TypeNumberBrand.float32, 'real');
        this.addType(type => type.kind === ReflectionKind.number && type.brand === TypeNumberBrand.float64, 'double precision');
        this.addType(type => type.kind === ReflectionKind.number && type.brand === TypeNumberBrand.float, 'double precision');

        this.addType(isUUIDType, 'uuid');
        this.addBinaryType('bytea');
        this.addType(type => type.kind === ReflectionKind.class && type.classType === Date, 'timestamp');
    }

    override getAggregateSelect(tableName: string, property: ReflectionProperty, func: string) {
        if (func === 'group_concat') {
            return `array_to_string(array_agg(${tableName}.${this.quoteIdentifier(property.name)}), ',')`;
        }
        return super.getAggregateSelect(tableName, property, func);
    }

    override createSqlFilterBuilder(schema: ReflectionClass<any>, tableName: string): PostgreSQLFilterBuilder {
        return new PostgreSQLFilterBuilder(schema, tableName, this.serializer, new this.placeholderStrategy, this.quoteValue.bind(this), this.quoteIdentifier.bind(this));
    }

    override quoteValue(value: any): string {
        if (!(value instanceof Date) && (isObject(value) || isArray(value))) return escapeLiteral(JSON.stringify(value));
        if (value instanceof Date) return 'TIMESTAMP ' + sqlstring.escape(value);
        return escapeLiteral(value);
    }

    override getColumnDDL(column: Column) {
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

    getUniqueDDL(unique: IndexModel): string {
        return `CONSTRAINT ${this.getIdentifier(unique)} UNIQUE (${this.getColumnListDDL(unique.columns)})`;
    }

    getDropIndexDDL(index: IndexModel): string {
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
