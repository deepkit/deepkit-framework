import {Column, ColumnDiff, ForeignKey, Index, Table, TableDiff} from '../schema/table';
import {ClassSchema, getClassSchema, isArray, Types} from '@super-hornet/marshal';
import {escape} from 'sqlstring';
import {ClassType, isPlainObject} from '@super-hornet/core';

export function isSet(v: any): boolean {
    return v !== '' && v !== undefined && v !== null;
}

export class DefaultPlatform {
    protected defaultSqlType = 'TEXT';
    protected typeMapping = new Map<string, { sqlType: string, size?: number, scale?: number }>();

    constructor() {
    }

    quoteValue(value: any): string {
        if (isPlainObject(value) || isArray(value)) return escape(JSON.stringify(value));
        //todo, add moment support
        return escape(value);
    }

    addBinaryType(sqlType: string, size?: number, scale?: number) {
        const binaryTypes: Types[] = ['Int8Array', 'Uint8Array', 'Uint8ClampedArray', 'Int16Array', 'Uint16Array', 'Int32Array', 'Uint32Array', 'Float32Array', 'Float64Array', 'arrayBuffer'];
        for (const type of binaryTypes) {
            this.addType(type, sqlType, size, scale);
        }
    }

    addType(marshalType: Types, sqlType: string, size?: number, scale?: number) {
        this.typeMapping.set(marshalType, {sqlType, size, scale});
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
    supportsPrimaryKeyBlock(): boolean {
        return true;
    }

    getPrimaryKeyDDL(table: Table) {
        if (!table.hasPrimaryKey()) return '';

        return `PRIMARY KEY (${this.getColumnListDDL(table.getPrimaryKeys())})`;
    }

    normalizeTables(tables: Table[]) {

    }

    createTables(schemas: (ClassSchema | ClassType)[]): Table[] {
        const generatedTables = new Map<ClassSchema, Table>();

        for (let schema of schemas) {
            schema = getClassSchema(schema);

            if (!schema.name) throw new Error(`No entity name for schema for class ${schema.getClassName()} given`);

            const table = new Table(schema.name);
            generatedTables.set(schema, table);

            for (const property of schema.getClassProperties().values()) {
                if (property.backReference) continue;

                const column = table.addColumn(property.name);

                column.type = this.defaultSqlType;
                const typeProperty = property.isReference ? property.getResolvedClassSchema().getPrimaryField() : property;
                const map = this.typeMapping.get(typeProperty.type);
                if (map) {
                    column.type = map.sqlType;
                    column.size = map.size;
                    column.scale = map.scale;
                }

                column.defaultValue = property.defaultValue;

                column.isNotNull = !property.isUndefinedAllowed() && !property.isNullable;
                column.isPrimaryKey = property.isId;
                column.isUnique = property.index && property.index.unique || false;
                column.isAutoIncrement = property.isAutoIncrement;
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
            }
        }

        const tables = [...generatedTables.values()];
        this.normalizeTables(tables);
        return tables;
    }

    quoteIdentifier(id: string): string {
        return `"${id.replace('.', '"."')}"`;
    }

    getTableIdentifier(schema: ClassSchema): string {
        if (!schema.name) throw new Error(`Class ${schema.getClassName()} has no name defined`);
        const collectionName = schema.collectionName || schema.name;

        if (schema.databaseName) return this.quoteIdentifier(schema.databaseName + this.getSchemaDelimiter() + collectionName);
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

    getAddPrimaryKeyDDL(table) {
        return `ALTER TABLE ${this.getIdentifier(table)} ADD ${this.getPrimaryKeyDDL(table)}`;
    }

    getBeginDDL(): string {
        return '';
    }

    getEndDDL(): string {
        return '';
    }

    getAddTablesDDL(tables: Table[]): string[] {
        const ddl: string[] = [];

        ddl.push(this.getBeginDDL());

        for (const table of tables) {
            ddl.push(this.getDropTableDDL(table));
            ddl.push(this.getAddTableDDL(table));
            ddl.push(this.getAddIndicesDDL(table));
        }

        ddl.push(this.getEndDDL());

        return ddl.filter(isSet);
    }

    getRenameTableDDL(from: Table, to: Table): string {
        return `ALTER TABLE ${this.getIdentifier(from)} RENAME TO ${this.getIdentifier(to)}`;
    }

    getModifyTableDDL(diff: TableDiff): string {
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
        if (diff.modifiedColumns.size) add(this.getModifyColumnsDDL(diff.modifiedColumns.values()));
        if (diff.addedColumns.size) add(this.getAddColumnsDDL(diff.addedColumns.values()));
        for (const column of diff.removedColumns.values()) add(this.getRemoveColumnDDL(column));

        // add new indices and foreign keys
        if (diff.hasModifiedPk()) add(this.getAddPrimaryKeyDDL(diff.to));

        if (alterTableLines.length) {
            ddl.push(`ALTER TABLE ${this.getIdentifier(diff.to)} ${alterTableLines.join(', ')}`);
        }

        // create indices, foreign keys
        for (const [, to] of diff.modifiedIndices.values()) ddl.push(this.getAddIndexDDL(to));
        for (const index of diff.addedIndices.values()) ddl.push(this.getAddIndexDDL(index));
        for (const [, to] of diff.modifiedFKs.values()) ddl.push(this.getAddForeignKeyDDL(to));
        for (const foreignKey of diff.addedFKs.values()) ddl.push(this.getAddForeignKeyDDL(foreignKey));

        return ddl.filter(isSet).join(';\n');
    }

    getAddTableDDL(table: Table): string {
        const lines: string[] = [];
        for (const column of table.columns) lines.push(this.getColumnDDL(column));
        if (this.supportsPrimaryKeyBlock() && table.hasPrimaryKey()) lines.push(this.getPrimaryKeyDDL(table));
        for (const unique of table.getUnices()) lines.push(this.getUniqueDDL(unique));
        for (const foreignKey of table.foreignKeys) lines.push(this.getForeignKeyDDL(foreignKey));

        return `CREATE TABLE ${this.getIdentifier(table)} (${lines.join(',\n')})`;
    }

    getAddForeignKeysDDL(table: Table): string {
        return table.foreignKeys.map(v => this.getAddForeignKeyDDL(v)).join('\n');
    }

    getAddIndicesDDL(table: Table): string {
        return table.getIndices().map(v => this.getAddIndexDDL(v)).join('\n');
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

        return `CREATE ${u} INDEX ${this.getIdentifier(index)} ON ${this.getIdentifier(index.table)} (${this.getColumnListDDL(index.columns)})`;
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

    getModifyColumnsDDL(columnDiffs: Iterable<ColumnDiff>): string {
        const lines: string[] = [];
        let table: Table | undefined;

        for (const diff of columnDiffs) {
            table = diff.to.table;
            lines.push(this.getColumnDDL(diff.to));
        }

        if (!table) return '';

        return `ALTER TABLE ${this.getIdentifier(table)} MODIFY (${lines.join(',\n')})`;
    }

    getAddColumnsDDL(columns: Iterable<Column>) {
        const lines: string[] = [];
        let table: Table | undefined;

        for (const column of columns) {
            table = column.table;
            lines.push(this.getColumnDDL(column));
        }

        if (!table) return '';

        return `ALTER TABLE ${this.getIdentifier(table)} ADD (${lines.join(',\n')})`;
    }

    getDropForeignKeyDDL(foreignKey: ForeignKey): string {
        return `ALTER TABLE ${this.getIdentifier(foreignKey.table)} DROP CONSTRAINT ${this.getIdentifier(foreignKey)}`;
    }

    getDropIndexDDL(index: Index): string {
        return `DROP INDEX ${this.getIdentifier(index)}`;
    }

    getUniqueDDL(unique: Index): string {
        return `UNIQUE (${this.getColumnListDDL(unique.columns)})`;
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
        //todo: allow to add expressions, like CURRENT_TIMESTAMP etc.
        return 'DEFAULT ' + JSON.stringify(column.defaultValue);
    }

    getAutoIncrement() {
        return 'IDENTITY';
    }

    getNotNullString() {
        return 'NOT NULL';
    }

    getNullString() {
        return 'NOT NULL';
    }
}

