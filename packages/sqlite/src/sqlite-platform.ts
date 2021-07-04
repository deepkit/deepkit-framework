/*
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */

import { Column, DefaultPlatform, ForeignKey, isSet, parseType, Table, TableDiff } from '@deepkit/sql';
import { ClassSchema, isArray, PropertySchema, SqliteOptions } from '@deepkit/type';
import { SQLiteSchemaParser } from './sqlite-schema-parser';
import { SqliteSerializer } from './sqlite-serializer';
import { SQLiteFilterBuilder } from './sql-filter-builder.sqlite';
import { isObject } from '@deepkit/core';
import sqlstring from 'sqlstring-sqlite';

export class SQLitePlatform extends DefaultPlatform {
    protected defaultSqlType = 'text';
    schemaParserType = SQLiteSchemaParser;

    public readonly serializer = SqliteSerializer;

    constructor() {
        super();
        this.addType('number', 'float');
        this.addType('date', 'text');
        this.addType('boolean', 'integer', 1);
        this.addType('uuid', 'blob');
        this.addBinaryType('blob');
    }

    quoteValue(value: any): string {
        if (isObject(value) || isArray(value)) return sqlstring.escape(JSON.stringify(value));
        return sqlstring.escape(value);
    }

    createSqlFilterBuilder(schema: ClassSchema, tableName: string): SQLiteFilterBuilder {
        return new SQLiteFilterBuilder(schema, tableName, this.serializer, new this.placeholderStrategy, this.quoteValue.bind(this), this.quoteIdentifier.bind(this));
    }

    getModifyTableDDL(diff: TableDiff): string[] {
        let changeViaMigrationTableNeeded =
            false
            || diff.modifiedFKs.length > 0
            || diff.modifiedIndices.length > 0
            || diff.modifiedColumns.length > 0
            || diff.renamedColumns.length > 0

            || diff.removedFKs.length > 0
            || diff.removedIndices.length > 0
            || diff.removedColumns.length > 0

            || diff.addedIndices.length > 0
            || diff.addedFKs.length > 0
            || diff.addedPKColumns.length > 0
            ;

        for (const column of diff.addedColumns) {
            const sqlChangeNotSupported = false
                //The field may not have a PRIMARY KEY or UNIQUE constraint.
                || column.isPrimaryKey
                || diff.to.hasIndex([column], true)

                //The field may not have a default value of CURRENT_TIME, CURRENT_DATE, CURRENT_TIMESTAMP,
                //or an expression in parentheses.
                || 'string' === typeof column.defaultValue && column.defaultValue.includes('(')

                //If a NOT NULL constraint is specified, then the field must have a default value other than NULL.
                || column.isNotNull && column.defaultValue === undefined
                ;

            if (sqlChangeNotSupported) {
                changeViaMigrationTableNeeded = true;
                break;
            }
        }

        if (changeViaMigrationTableNeeded) {
            return this.getMigrationTableDDL(diff);
        }

        return super.getModifyTableDDL(diff);
    }

    protected getMigrationTableDDL(diff: TableDiff): string[] {
        const lines: string[] = [];

        // const tempName = diff.to.getName() + '__temp__' + (Math.floor(Math.random() * 10000));
        // const select = diff.from.columns.map(v => this.quoteIdentifier(v.name));

        const oldToName = diff.to.getName();
        const tempToName = oldToName + '__temp_new__' + (Math.floor(Math.random() * 10000));
        diff.to.name = tempToName;
        lines.push(this.getDropTableDDL(diff.to));
        lines.push(...this.getAddTableDDL(diff.to));
        diff.to.name = oldToName;

        // lines.push(`CREATE TABLE ${this.quoteIdentifier(tempName)} AS SELECT ${select.join(',')} FROM ${this.getIdentifier(diff.to)}`);
        const selectMap = new Map<string, string>();
        for (const columnDiff of diff.modifiedColumns) {
            selectMap.set(columnDiff.from.name, columnDiff.to.name);
        }

        for (const [from, to] of diff.renamedColumns) {
            selectMap.set(from.name, to.name);
        }

        for (const column of diff.to.columns) {
            if (diff.from.hasColumn(column.name)) {
                if (!selectMap.has(column.name)) {
                    selectMap.set(column.name, column.name);
                }
            }
        }

        const fromSelect = [...selectMap.keys()].map(v => this.quoteIdentifier(v));
        const toSelect = [...selectMap.values()].map(v => this.quoteIdentifier(v));

        lines.push(`INSERT INTO ${this.quoteIdentifier(tempToName)} (${toSelect.join(', ')}) SELECT ${fromSelect.join(',')} FROM ${this.getIdentifier(diff.from)}`);
        lines.push(`DROP TABLE ${this.getIdentifier(diff.from)}`);
        lines.push(`ALTER TABLE ${this.quoteIdentifier(tempToName)} RENAME TO ${this.getIdentifier(diff.to)}`);

        lines.push(...this.getAddIndicesDDL(diff.to));

        return lines.filter(isSet);
    }

    protected setColumnType(column: Column, typeProperty: PropertySchema) {
        const db = (typeProperty.data['sqlite'] || {}) as SqliteOptions;
        if (db.type) {
            parseType(column, db.type);
            return;
        }

        if (typeProperty.isAutoIncrement) {
            column.type = 'integer';
            return;
        }

        super.setColumnType(column, typeProperty);
    }

    /**
     * Unfortunately, SQLite does not support composite pks where one is AUTOINCREMENT,
     * so we have to flag both as NOT NULL and create in either way a UNIQUE constraint over pks since
     * those UNIQUE is otherwise automatically created by the sqlite engine.
     */
    normalizeTables(tables: Table[]) {

        //make sure autoIncrement is INTEGER size undefined
        for (const table of tables) {
            for (const column of table.getAutoIncrements()) {
                column.isPrimaryKey = true;
                column.size = undefined;
            }
        }

        //the default platform creates for each foreign key an index.

        //todo, support composite pks where one is AUTOINCREMENT

        super.normalizeTables(tables);
    }

    //we manually set PRIMARY KEY in getColumnDDL
    supportsInlinePrimaryKey(): boolean {
        return false;
    }

    getSchemaDelimiter(): string {
        return '§';
    }

    getBeginDDL(): string {
        return `PRAGMA foreign_keys = OFF`;
    }

    getEndDDL(): string {
        return `PRAGMA foreign_keys = ON`;
    }

    getAutoIncrement() {
        return 'AUTOINCREMENT';
    }

    getColumnDDL(column: Column) {
        const ddl: string[] = [];

        ddl.push(this.getIdentifier(column));
        ddl.push((column.type || 'INTEGER') + column.getSizeDefinition());
        if (column.isPrimaryKey) ddl.push('PRIMARY KEY');
        if (column.isAutoIncrement) ddl.push(this.getAutoIncrement());

        ddl.push(this.getColumnDefaultValueDDL(column));
        ddl.push(column.isNotNull ? this.getNotNullString() : this.getNullString());

        return ddl.filter(isSet).join(' ');
    }

    getForeignKeyDDL(foreignKey: ForeignKey): string {
        const ddl: string[] = [];

        ddl.push(`
        FOREIGN KEY (${this.getColumnListDDL(foreignKey.localColumns)})
        REFERENCES ${this.getIdentifier(foreignKey.foreign)} (${this.getColumnListDDL(foreignKey.foreignColumns)})
        `.trim());

        if (foreignKey.onUpdate) ddl.push(`ON UPDATE ${foreignKey.onUpdate}`);
        if (foreignKey.onDelete) ddl.push(`ON DELETE ${foreignKey.onDelete}`);

        return ddl.join(' ');
    }
}
