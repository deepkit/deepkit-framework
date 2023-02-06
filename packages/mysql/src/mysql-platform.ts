/*
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */

import { Pool } from 'mariadb';
import { mySqlSerializer } from './mysql-serializer';
import { isUUIDType, ReflectionKind, ReflectionProperty, Serializer, TypeNumberBrand } from '@deepkit/type';
import { Column, DefaultPlatform, IndexModel, isSet } from '@deepkit/sql';
import { MysqlSchemaParser } from './mysql-schema-parser';

export class MySQLPlatform extends DefaultPlatform {
    protected override defaultSqlType = 'longtext';
    protected override annotationId = 'mysql';
    protected override defaultNowExpression = 'now()';
    override schemaParserType = MysqlSchemaParser;

    public override readonly serializer: Serializer = mySqlSerializer;

    constructor(protected pool: Pool) {
        super();

        this.nativeTypeInformation.set('blob', { needsIndexPrefix: true, defaultIndexSize: 767 });
        this.nativeTypeInformation.set('longtext', { needsIndexPrefix: true, defaultIndexSize: 767 });
        this.nativeTypeInformation.set('longblob', { needsIndexPrefix: true, defaultIndexSize: 767 });

        this.addType(ReflectionKind.class, 'json');
        this.addType(ReflectionKind.objectLiteral, 'json');
        this.addType(ReflectionKind.array, 'json');
        this.addType(ReflectionKind.union, 'json');

        this.addType(v => v.kind === ReflectionKind.enum && v.indexType.kind === ReflectionKind.number, 'integer');
        this.addType(v => v.kind === ReflectionKind.enum && v.indexType.kind === ReflectionKind.string, 'VARCHAR', 255);
        this.addType(v => v.kind === ReflectionKind.enum && v.indexType.kind === ReflectionKind.union, 'json');

        this.addType(v => v.kind === ReflectionKind.any, 'json');

        this.addType(ReflectionKind.number, 'double');
        this.addType(ReflectionKind.bigint, 'bigint');
        this.addType(type => type.kind === ReflectionKind.number && type.brand === TypeNumberBrand.integer, 'int');
        this.addType(type => type.kind === ReflectionKind.number && type.brand === TypeNumberBrand.int8, 'tinyint');
        this.addType(type => type.kind === ReflectionKind.number && type.brand === TypeNumberBrand.uint8, 'tinyint', undefined, undefined, true);
        this.addType(type => type.kind === ReflectionKind.number && type.brand === TypeNumberBrand.int16, 'smallint');
        this.addType(type => type.kind === ReflectionKind.number && type.brand === TypeNumberBrand.uint16, 'smallint', undefined, undefined, true);
        this.addType(type => type.kind === ReflectionKind.number && type.brand === TypeNumberBrand.int32, 'int');
        this.addType(type => type.kind === ReflectionKind.number && type.brand === TypeNumberBrand.uint32, 'int', undefined, undefined, true);
        this.addType(type => type.kind === ReflectionKind.number && type.brand === TypeNumberBrand.float32, 'float');
        this.addType(type => type.kind === ReflectionKind.number && type.brand === TypeNumberBrand.float64, 'double');
        this.addType(type => type.kind === ReflectionKind.number && type.brand === TypeNumberBrand.float, 'double');

        this.addType(type => type.kind === ReflectionKind.class && type.classType === Date, 'datetime');
        this.addType(ReflectionKind.boolean, 'tinyint', 1);
        this.addType(isUUIDType, 'binary', 16);

        this.addBinaryType('longblob');
    }

    supportsSelectFor(): boolean {
        return true;
    }

    protected setColumnType(column: Column, typeProperty: ReflectionProperty) {
        super.setColumnType(column, typeProperty);

        if (column.type && (column.defaultExpression !== undefined || column.defaultValue !== undefined)) {
            const typesWithoutDefault = ['blob', 'longblob', 'longtext', 'text', 'geometry', 'json'];
            //BLOB, TEXT, GEOMETRY or JSON column 'content' can't have a default value
            if (typesWithoutDefault.includes(column.type)) {
                column.defaultValue = undefined;
                column.defaultExpression = undefined;
            }
        }
    }

    getDropIndexDDL(index: IndexModel): string {
        return `DROP INDEX ${this.getIdentifier(index)} ON ${this.getIdentifier(index.table)}`;
    }

    getColumnDDL(column: Column) {
        const ddl: string[] = [];

        ddl.push(this.getIdentifier(column));
        ddl.push((column.type || 'INTEGER') + column.getSizeDefinition());
        if (column.unsigned) ddl.push('UNSIGNED');
        ddl.push(this.getColumnDefaultValueDDL(column));
        ddl.push(column.isNotNull ? this.getNotNullString() : this.getNullString());
        if (column.isAutoIncrement) ddl.push(this.getAutoIncrement());

        return ddl.filter(isSet).join(' ');
    }

    quoteValue(value: any): string {
        return this.pool.escape(value);
    }

    quoteIdentifier(id: string): string {
        return this.pool.escapeId(id);
    }

    getAutoIncrement() {
        return 'AUTO_INCREMENT';
    }

    getBeginDDL(): string {
        return `
# This is a fix for InnoDB in MySQL >= 4.1.x
# It "suspends judgement" for foreign key relationships until all tables are set.
SET FOREIGN_KEY_CHECKS = 0;`;
    }

    getEndDDL(): string {
        return `
# This restores the foreign key checks, after having unset them earlier
SET FOREIGN_KEY_CHECKS = 1;`;
    }
}
