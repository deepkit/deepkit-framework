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

import { Column, ColumnDiff, DatabaseDiff, DatabaseModel, ForeignKey, Index, Table, TableDiff } from '../schema/table';
import { binaryTypes, ClassSchema, getClassSchema, isArray, PropertySchema, Serializer, Types } from '@deepkit/type';
import sqlstring from 'sqlstring';
import { ClassType, isObject } from '@deepkit/core';
import { sqlSerializer } from '../serializer/sql-serializer';
import { SchemaParser } from '../reverse/schema-parser';
import { SQLFilterBuilder } from '../sql-filter-builder';

export function isSet(v: any): boolean {
    return v !== '' && v !== undefined && v !== null;
}

export interface NamingStrategy {
    getColumnName(property: PropertySchema): string;

    getTableName(classSchema: ClassSchema): string;
}

export class DefaultNamingStrategy implements NamingStrategy {
    getColumnName(property: PropertySchema): string {
        return property.name;
    }

    getTableName(classSchema: ClassSchema): string {
        return classSchema.getCollectionName();
    }
}

interface NativeTypeInformation {
    needsIndexPrefix: boolean;
    defaultIndexSize: number;
}

export abstract class DefaultPlatform {
    protected defaultSqlType = 'text';
    protected typeMapping = new Map<string, { sqlType: string, size?: number, scale?: number }>();
    protected nativeTypeInformation = new Map<string, Partial<NativeTypeInformation>>();

    public abstract schemaParserType: ClassType<SchemaParser>;

    public serializer: Serializer = sqlSerializer;
    public namingStrategy: NamingStrategy = new DefaultNamingStrategy();

    createSqlFilterBuilder(schema: ClassSchema, tableName: string): SQLFilterBuilder {
        return new SQLFilterBuilder(schema, tableName, this.serializer, this.quoteValue.bind(this), this.quoteIdentifier.bind(this));
    }

    getMigrationTableName() {
        return `deepkit_orm_migration`;
    }

    quoteValue(value: any): string {
        if (!(value instanceof Date) && (isObject(value) || isArray(value))) return sqlstring.escape(JSON.stringify(value));
        return sqlstring.escape(value);
    }

    getAggregateSelect(tableName: string, property: PropertySchema, func: string) {
        return `${func}(${tableName}.${this.quoteIdentifier(property.name)})`;
    }

    addBinaryType(sqlType: string, size?: number, scale?: number) {
        for (const type of binaryTypes) {
            this.addType(type, sqlType, size, scale);
        }
    }

    addType(marshalType: Types, sqlType: string, size?: number, scale?: number) {
        this.typeMapping.set(marshalType, { sqlType, size, scale });
    }

    getColumnListDDL(columns: Column[]) {
        return columns.map(v => this.getIdentifier(v)).join(', ');
    }

    getSchemaDelimiter(): string {
        return '.';
    }

    /**
     * If the platform supports the `PRIMARY KEY` section in `CREATE TABLE(column, column, PRIMARY KEY())`;
     */
    supportsInlinePrimaryKey(): boolean {
        return true;
    }

    /**
     * If the platform supports the `CONSTRAINT %s FOREIGN KEY` section in `CREATE TABLE(column, column, CONSTRAINT %s FOREIGN KEY)`;
     */
    supportsInlineForeignKey(): boolean {
        return true;
    }

    getPrimaryKeyDDL(table: Table) {
        if (!table.hasPrimaryKey()) return '';

        return `PRIMARY KEY (${this.getColumnListDDL(table.getPrimaryKeys())})`;
    }

    normalizeTables(tables: Table[]) {

    }

    getEntityFields(schema: ClassSchema): PropertySchema[] {
        const fields: PropertySchema[] = [];
        for (const property of schema.getClassProperties().values()) {
            if (property.isParentReference) continue;
            if (property.backReference) continue;
            fields.push(property);
        }
        return fields;
    }

    protected setColumnType(column: Column, typeProperty: PropertySchema) {
        column.type = this.defaultSqlType;
        const map = this.typeMapping.get(typeProperty.type);
        if (map) {
            column.type = map.sqlType;
            column.size = map.size;
            column.scale = map.scale;
        }
    }

    getModifyDatabaseDDL(databaseDiff: DatabaseDiff): string[] {
        const lines: string[] = [];

        for (const table of databaseDiff.removedTables) lines.push(this.getDropTableDDL(table));
        for (const [from, to] of databaseDiff.renamedTables) lines.push(this.getRenameTableDDL(from, to));

        for (const table of databaseDiff.addedTables) {
            lines.push(...this.getAddTableDDL(table));
            lines.push(...this.getAddIndicesDDL(table));
        }

        for (const tableDiff of databaseDiff.modifiedTables) lines.push(...this.getModifyTableDDL(tableDiff));

        if (!this.supportsInlineForeignKey()) {
            for (const table of databaseDiff.addedTables) lines.push(...this.getAddForeignKeysDDL(table));
        }

        if (lines.length) {
            lines.unshift(this.getBeginDDL());
            lines.push(this.getEndDDL());
        }

        return lines.filter(isSet);
    }

    createTables(schemas: (ClassSchema | ClassType)[], database: DatabaseModel = new DatabaseModel()): Table[] {
        const generatedTables = new Map<ClassSchema, Table>();

        for (let schema of schemas) {
            schema = getClassSchema(schema);

            if (!schema.name) throw new Error(`No entity name for schema for class ${schema.getClassName()} given`);

            const table = new Table(this.namingStrategy.getTableName(schema));
            generatedTables.set(schema, table);

            table.schemaName = schema.databaseSchemaName || database.schemaName;

            for (const property of this.getEntityFields(schema)) {
                if (property.backReference) continue;

                const column = table.addColumn(this.namingStrategy.getColumnName(property), property);

                column.defaultValue = property.getDefaultValue();

                const isNullable = property.isNullable || property.isOptional;
                column.isNotNull = !isNullable;
                column.isPrimaryKey = property.isId;
                if (property.isAutoIncrement) {
                    column.isAutoIncrement = true;
                    column.isNotNull = true;
                }

                const typeProperty = property.isReference ? property.getResolvedClassSchema().getPrimaryField() : property;
                this.setColumnType(column, typeProperty);
            }
        }

        //set foreign keys
        for (let schema of schemas) {
            schema = getClassSchema(schema);

            const table = generatedTables.get(schema)!;

            for (const property of schema.getClassProperties().values()) {
                if (!property.isReference) continue;

                const foreignTable = generatedTables.get(property.getResolvedClassSchema())!;
                const foreignKey = table.addForeignKey('', foreignTable);
                foreignKey.localColumns = [table.getColumn(property.name)];
                foreignKey.foreignColumns = foreignTable.getPrimaryKeys();
                foreignKey.onDelete = property.referenceOptions.onDelete;
                foreignKey.onUpdate = property.referenceOptions.onUpdate;
            }
        }

        //create index
        for (let schema of schemas) {
            schema = getClassSchema(schema);
            const table = generatedTables.get(schema)!;

            for (const [name, index] of schema.indices.entries()) {
                if (table.hasIndexByName(name)) continue;
                const columns = index.fields.map(v => table.getColumn(v));
                if (table.hasIndex(columns, index.options.unique)) continue;

                const addedIndex = table.addIndex(name, index.options.unique);
                addedIndex.columns = columns;
                addedIndex.spatial = index.options.spatial || false;
            }

            for (const foreignKeys of table.foreignKeys) {
                if (table.hasIndex(foreignKeys.localColumns)) continue;
                const index = table.addIndex(foreignKeys.getName(), false);
                index.columns = foreignKeys.localColumns;
            }

            for (const property of schema.getClassProperties().values()) {
                if (!property.index) continue;

                const column = table.getColumnForProperty(property);
                if (table.hasIndex([column], property.index.unique)) continue;

                const index = table.addIndex('', property.index.unique);
                index.columns = [column];
            }
        }

        const tables = [...generatedTables.values()];
        this.normalizeTables(tables);
        database.tables = tables;
        return tables;
    }

    quoteIdentifier(id: string): string {
        return `"${id.replace('.', '"."')}"`;
    }

    getTableIdentifier(schema: ClassSchema): string {
        if (!schema.name) throw new Error(`Class ${schema.getClassName()} has no name defined`);
        const collectionName = this.namingStrategy.getTableName(schema);

        if (schema.databaseSchemaName) return this.quoteIdentifier(schema.databaseSchemaName + this.getSchemaDelimiter() + collectionName);
        return this.quoteIdentifier(collectionName);
    }

    getIdentifier(object: Table | Column | Index | ForeignKey, append: string = ''): string {
        if (object instanceof Table) return this.getFullIdentifier(object, append);
        return this.quoteIdentifier(object.getName() + append);
    }

    getFullIdentifier(object: Table | Column, append: string = ''): string {
        return this.quoteIdentifier(object.getFullName(this.getSchemaDelimiter()) + append);
    }

    getPrimaryKeyName(table: Table): string {
        return this.getFullIdentifier(table, '_pk');
    }

    getDropPrimaryKeyDDL(table: Table) {
        if (!table.hasPrimaryKey()) return '';

        return `ALTER TABLE ${this.getIdentifier(table)} DROP CONSTRAINT ${this.getPrimaryKeyName(table)}`;
    }

    getAddPrimaryKeyDDL(table: Table) {
        return `ALTER TABLE ${this.getIdentifier(table)} ADD ${this.getPrimaryKeyDDL(table)}`;
    }

    getBeginDDL(): string {
        return '';
    }

    getEndDDL(): string {
        return '';
    }

    getAddTablesDDL(database: DatabaseModel): string[] {
        const ddl: string[] = [];

        ddl.push(this.getBeginDDL());

        for (const table of database.tables) {
            ddl.push(this.getDropTableDDL(table));
            ddl.push(...this.getAddTableDDL(table));
            ddl.push(...this.getAddIndicesDDL(table));
        }

        for (const table of database.tables) {
            if (!this.supportsInlineForeignKey()) ddl.push(...this.getAddForeignKeysDDL(table));
        }

        ddl.push(this.getEndDDL());

        return ddl.filter(isSet);
    }

    getAddSchemasDDL(database: DatabaseModel): string {
        const schemaNames = new Set<string>();

        if (database.schemaName) schemaNames.add(database.schemaName);
        for (const table of database.tables) {
            if (table.schemaName) schemaNames.add(table.schemaName);
        }

        return [...schemaNames.values()].map(v => this.getAddSchemaDDL(v)).join(';\n');
    }

    getAddSchemaDDL(schemaName: string): string {
        if (!schemaName) return '';
        return `CREATE SCHEMA ${this.quoteIdentifier(schemaName)}`;
    }

    getUseSchemaDDL(table: Table) {
        return ``;
    }

    getResetSchemaDDL(table: Table): string {
        return ``;
    }

    getRenameTableDDL(from: Table, to: Table): string {
        return `ALTER TABLE ${this.getIdentifier(from)} RENAME TO ${this.getIdentifier(to)}`;
    }

    getModifyTableDDL(diff: TableDiff): string[] {
        const ddl: string[] = [];

        // drop indices, foreign keys
        for (const foreignKey of diff.removedFKs.values()) ddl.push(this.getDropForeignKeyDDL(foreignKey));
        for (const [from] of diff.modifiedFKs.values()) ddl.push(this.getDropForeignKeyDDL(from));
        for (const index of diff.removedIndices.values()) ddl.push(this.getDropIndexDDL(index));
        for (const [from] of diff.modifiedIndices.values()) ddl.push(this.getDropIndexDDL(from));

        //merge field changes into one command. This is more compatible especially with PK constraints.
        const alterTableLines: string[] = [];

        function add(value: string) {
            if (value.trim().startsWith('ALTER TABLE')) {
                alterTableLines.push(value.trim().substr('ALTER TABLE '.length));
            } else {
                ddl.push(value);
            }
        }

        // alter entity structure
        if (diff.hasModifiedPk()) add(this.getDropPrimaryKeyDDL(diff.from));
        for (const [from, to] of diff.renamedColumns.values()) add(this.getRenameColumnDDL(from, to));
        if (diff.modifiedColumns.length) for (const columnDiff of diff.modifiedColumns) add(this.getModifyColumnDDL(columnDiff));
        if (diff.addedColumns.length) for (const column of diff.addedColumns) add(this.getAddColumnDDL(column));
        for (const column of diff.removedColumns.values()) add(this.getRemoveColumnDDL(column));

        if (diff.hasModifiedPk()) add(this.getAddPrimaryKeyDDL(diff.to));

        if (alterTableLines.length) {
            ddl.push(`ALTER TABLE ${alterTableLines.join(', ')}`);
        }

        // create indices, foreign keys
        for (const [, to] of diff.modifiedIndices.values()) ddl.push(this.getAddIndexDDL(to));
        for (const index of diff.addedIndices.values()) ddl.push(this.getAddIndexDDL(index));
        for (const [, to] of diff.modifiedFKs.values()) ddl.push(this.getAddForeignKeyDDL(to));
        for (const foreignKey of diff.addedFKs.values()) ddl.push(this.getAddForeignKeyDDL(foreignKey));

        return ddl.filter(isSet);
    }

    getAddTableDDL(table: Table): string[] {
        const lines: string[] = [];

        lines.push(this.getUseSchemaDDL(table));

        lines.push(this.getCreateTableDDL(table));

        lines.push(this.getResetSchemaDDL(table));

        return lines.filter(isSet);
    }

    getCreateTableDDL(table: Table): string {
        const lines: string[] = [];
        for (const column of table.columns) lines.push(this.getColumnDDL(column));
        if (this.supportsInlinePrimaryKey() && table.hasPrimaryKey()) lines.push(this.getPrimaryKeyDDL(table));
        if (this.supportsInlineForeignKey()) for (const foreignKey of table.foreignKeys) lines.push(this.getForeignKeyDDL(foreignKey));

        return `CREATE TABLE ${this.getIdentifier(table)} (\n    ${lines.join(',\n    ')}\n)`;
    }

    getAddForeignKeysDDL(table: Table): string[] {
        return table.foreignKeys.map(v => this.getAddForeignKeyDDL(v)).filter(isSet);
    }

    getAddIndicesDDL(table: Table): string[] {
        return table.indices.map(v => this.getAddIndexDDL(v));
    }

    getAddForeignKeyDDL(foreignKey: ForeignKey): string {
        return `ALTER TABLE ${this.getIdentifier(foreignKey.table)} ADD ${this.getForeignKeyDDL(foreignKey)}`;
    }

    getForeignKeyDDL(foreignKey: ForeignKey): string {
        const ddl: string[] = [];

        ddl.push(`
        CONSTRAINT ${this.getIdentifier(foreignKey)} 
        FOREIGN KEY (${this.getColumnListDDL(foreignKey.localColumns)}) 
        REFERENCES ${this.getIdentifier(foreignKey.foreign)} (${this.getColumnListDDL(foreignKey.foreignColumns)})
        `.trim());

        if (foreignKey.onUpdate) ddl.push(`ON UPDATE ${foreignKey.onUpdate}`);
        if (foreignKey.onDelete) ddl.push(`ON DELETE ${foreignKey.onDelete}`);

        return ddl.join(' ');
    }

    getAddIndexDDL(index: Index): string {
        const u = index.isUnique ? 'UNIQUE' : '';

        const columns: string[] = [];
        for (const column of index.columns) {
            if (index.size) {
                columns.push(`${this.getIdentifier(column)}(${index.size})`);
                continue;
            }

            const typeInfo = this.nativeTypeInformation.get(column.type || '');
            if (typeInfo && typeInfo.needsIndexPrefix) {
                columns.push(`${this.getIdentifier(column)}(${typeInfo.defaultIndexSize || 100})`);
                continue;
            }

            columns.push(`${this.getIdentifier(column)}`);
        }

        return `CREATE ${u} INDEX ${this.getIdentifier(index)} ON ${this.getIdentifier(index.table)} (${columns.join(', ')})`;
    }

    getDropTableDDL(table: Table): string {
        return `DROP TABLE IF EXISTS ${this.getIdentifier(table)}`;
    }

    // getAddColumnDDL(column: Column): string {
    //     return `ALTER TABLE ${this.getIdentifier(column.table)} ADD ${this.getColumnDDL(column)}`;
    // }

    getRemoveColumnDDL(column: Column): string {
        return `ALTER TABLE ${this.getIdentifier(column.table)} DROP COLUMN ${this.getIdentifier(column)}`;
    }

    getRenameColumnDDL(from: Column, to: Column): string {
        return `ALTER TABLE ${this.getIdentifier(from.table)} RENAME COLUMN ${this.getIdentifier(from)} TO ${this.getIdentifier(to)}`;
    }

    // getModifyColumnDDL(column: Column): string {
    //     return `ALTER TABLE ${this.getIdentifier(column.table)} MODIFY ${this.getColumnDDL(column)}`;
    // }

    getModifyColumnDDL(diff: ColumnDiff): string {
        return `ALTER TABLE ${this.getIdentifier(diff.to.table)} MODIFY ${this.getColumnDDL(diff.to)}`;
    }

    getAddColumnDDL(column: Column) {
        return `ALTER TABLE ${this.getIdentifier(column.table)} ADD ${this.getColumnDDL(column)}`;
    }

    getDropForeignKeyDDL(foreignKey: ForeignKey): string {
        return `ALTER TABLE ${this.getIdentifier(foreignKey.table)} DROP CONSTRAINT ${this.getIdentifier(foreignKey)}`;
    }

    getDropIndexDDL(index: Index): string {
        return `DROP INDEX ${this.getIdentifier(index)}`;
    }

    getUniqueDDL(unique: Index): string {
        return `UNIQUE INDEX ${this.getIdentifier(unique)} (${this.getColumnListDDL(unique.columns)})`;
    }

    getColumnDDL(column: Column) {
        const ddl: string[] = [];

        ddl.push(this.getIdentifier(column));
        ddl.push((column.type || 'INTEGER') + column.getSizeDefinition());
        ddl.push(this.getColumnDefaultValueDDL(column));
        ddl.push(column.isNotNull ? this.getNotNullString() : this.getNullString());
        if (column.isAutoIncrement) ddl.push(this.getAutoIncrement());

        return ddl.filter(isSet).join(' ');
    }

    getColumnDefaultValueDDL(column: Column) {
        if (undefined === column.defaultValue) return '';
        //todo: allow to add expressions, like CURRENT_TIMESTAMP
        return 'DEFAULT ' + this.quoteValue(isObject(column.defaultValue) ? JSON.stringify(column.defaultValue) : column.defaultValue);
    }

    getAutoIncrement() {
        return 'IDENTITY';
    }

    getNotNullString() {
        return 'NOT NULL';
    }

    getNullString() {
        return 'NULL';
    }
}

