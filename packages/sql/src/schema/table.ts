import {arrayRemoveItem} from '@deepkit/core';
import {createHash} from 'crypto';
import {PropertySchema} from '@deepkit/type';
import {inspect} from "util";

export class DatabaseModel {
    public schemaName: string = '';

    constructor(public tables: Table[] = []) {
    }

    addTable(name: string) {
        const table = new Table(name);
        this.tables.push(table);
        return table;
    }

    getTable(name: string, schemaName?: string): Table {
        const table = this.tables.find(v => v.isName(name, schemaName));
        if (!table) throw new Error(`Could not find table ${name} in schema ${schemaName}`);
        return table;
    }

    getTableNames(): string[] {
        return this.tables.map(v => v.getName());
    }

    getTableForFull(fullName: string, schemaDelimiter: string): Table {
        let name = fullName.includes(schemaDelimiter) ? fullName.split(schemaDelimiter)[0] : fullName;
        let schemaName = fullName.includes(schemaDelimiter) ? fullName.split(schemaDelimiter)[1] : '';
        return this.getTable(name, schemaName);
    }
}

export class Table {
    public schemaName: string = '';
    public alias: string = '';

    public columnForProperty: Map<PropertySchema, Column> = new Map;
    public columns: Column[] = [];
    public indices: Index[] = [];
    public foreignKeys: ForeignKey[] = [];

    constructor(
        public name: string,
    ) {
    }

    isName(name: string, schemaName?: string): boolean {
        if (schemaName && schemaName !== this.schemaName) return false;
        return this.name === name;
    }

    getName(): string {
        return this.name;
    }

    getFullName(schemaDelimiter: string): string {
        return (this.schemaName ? this.schemaName + schemaDelimiter : '') + this.name;
    }

    addColumn(name: string, property?: PropertySchema): Column {
        const column = new Column(this, name);
        this.columns.push(column);
        if (property) this.columnForProperty.set(property, column);
        return column;
    }

    addIndex(name: string, unique = false): Index {
        const index = new Index(this, name, unique);
        this.indices.push(index);
        return index;
    }

    addForeignKey(name: string, foreignTable: Table): ForeignKey {
        const foreignKey = new ForeignKey(this, name, foreignTable);
        this.foreignKeys.push(foreignKey);
        return foreignKey;
    }

    hasColumn(name: string): boolean {
        return this.columns.some(v => v.name === name);
    }

    getColumn(name: string): Column {
        const column = this.columns.find(v => v.name === name);
        if (!column) throw new Error(`Column ${name} not found at table ${this.name}`);
        return column;
    }

    getColumnForProperty(property: PropertySchema): Column {
        const column = this.columnForProperty.get(property);
        if (!column) throw new Error(`Column ${property.name} not found at table ${this.name}`);
        return column;
    }

    getPrimaryKeys(): Column[] {
        return this.columns.filter(v => v.isPrimaryKey);
    }

    getAutoIncrements(): Column[] {
        return this.columns.filter(v => v.isAutoIncrement);
    }

    getIndices() {
        return this.indices.filter(v => !v.isUnique);
    }

    getIndex(name: string) {
        return this.indices.find(v => v.getName() === name);
    }

    getUnices() {
        return this.indices.filter(v => v.isUnique);
    }

    hasPrimaryKey() {
        return this.getPrimaryKeys().length > 0;
    }

    hasCompositePrimaryKey() {
        return this.getPrimaryKeys().length > 1;
    }

    getForeignKeyOfLocalColumn(column: Column): ForeignKey | undefined {
        for (const foreignKey of this.foreignKeys) {
            if (foreignKey.localColumns.includes(column)) return foreignKey;
        }
        return;
    }

    hasIndexByName(name: string): boolean {
        for (const index of this.indices) {
            if (name && index.name === name) return true;
        }
        return false;
    }

    hasIndex(columns: Column[], unique = false): boolean {
        //the order in index is important, so we don't mess with that.
        const indexName = columns.map(v => v.name).join(',');
        for (const index of this.indices) {
            if (index.isUnique !== unique) continue;
            const thisIndexName = index.columns.map(v => v.name).join(',');
            if (thisIndexName === indexName) return true;
        }
        return false;
    }

}

export class Column {
    public description: string = '';

    public type?: string;
    public size?: number;
    public scale?: number;
    public defaultValue?: string;

    public isNotNull = false;
    public isPrimaryKey = false;
    public isAutoIncrement = false;

    constructor(
        public table: Table,
        public name: string //real column name (probably transformed to snake case, or something)
    ) {
    }

    getName(): string {
        return this.name;
    }

    getFullName(): string {
        return this.table.getName() + '.' + this.getName();
    }

    getSizeDefinition() {
        if (undefined === this.size) return '';
        if (undefined !== this.scale) return `(${this.size}, ${this.scale})`;
        return `(${this.size})`;
    }
}

export class Index {
    public columns: Column[] = [];

    public spatial: boolean = false;
    public partial: boolean = false;

    public size: number = 0;

    constructor(public table: Table, public name: string, public isUnique = false) {
    }

    getName(): string {
        if (!this.name) {
            const hash: string[] = [];
            for (const column of this.columns) hash.push(column.name + '/' + column.size);
            const md5 = createHash('md5');
            md5.update(hash.join('|'), 'utf8');
            const prefix = this.isUnique ? 'u' : 'i';
            return this.table.getName() + '_' + prefix + md5.digest('hex').substr(0, 6);
        }

        return this.name;
    }

    hasColumn(columnName: string) {
        return this.columns.some(v => v.getName() === columnName);
    }

    addColumn(columnName: string) {
        this.columns.push(this.table.getColumn(columnName));
    }

    valueOf(): string {
        return `${this.isUnique ? 'UNIQUE INDEX' : 'INDEX'} ${this.getName()} COLUMNS(${this.columns.map(v => v.getName())})`;
    }
}

export type ForeignKeyAction = 'RESTRICT' | 'NO ACTION' | 'CASCADE' | 'SET NULL' | 'SET DEFAULT';

export class ForeignKey {
    public localColumns: Column[] = [];
    public foreignColumns: Column[] = [];

    public onUpdate: ForeignKeyAction = 'CASCADE';
    public onDelete: ForeignKeyAction = 'CASCADE';

    constructor(public table: Table, public name: string, public foreign: Table) {
    }

    getName(): string {
        if (!this.name) {
            const hash: string[] = [];
            for (const column of this.localColumns) hash.push(column.name + '/' + column.size);
            for (const column of this.foreignColumns) hash.push(column.name + '/' + column.size);
            const md5 = createHash('md5');
            md5.update(hash.join('|'), 'utf8');
            return this.table.getName() + '_fk' + md5.digest('hex').substr(0, 6);
        }

        return this.name;
    }

    addReference(localColumnName: string, foreignColumnName: string) {
        this.localColumns.push(this.table.getColumn(localColumnName));
        this.foreignColumns.push(this.foreign.getColumn(foreignColumnName));
    }

    getColumnMapping(): [from: Column, to: Column][] {
        const res: [from: Column, to: Column][] = [];
        for (let i = 0; i < this.localColumns.length; i++) {
            res.push([this.localColumns[i], this.foreignColumns[i]]);
        }
        return res;
    }

    valueOf() {
        return `fk=${this.getName()} to ${this.foreign.getName()} (${this.getColumnMapping().map(([from, to]) => `${from.getName()}=>${to.getName()}`)})`;
    }
}

export class ColumnPropertyDiff {
    constructor(public readonly from: any, public readonly to: any) {
    }
}

export class ColumnDiff {
    constructor(
        public from: Column,
        public to: Column,
        public changedProperties = new Map<keyof Column, ColumnPropertyDiff>()
    ) {
    }

    valueOf() {
        const res: string[] = [];
        for (const [key, value] of this.changedProperties.entries()) {
            res.push(`${key}: ${JSON.stringify(value.from)}=>${JSON.stringify(value.to)}`)
        }
        return res.join(',');
    }
}

export class ColumnComparator {
    static computeDiff(from: Column, to: Column) {
        const diff = ColumnComparator.compareColumns(from, to);
        return diff.size ? new ColumnDiff(from, to, diff) : undefined;
    }

    static compareColumns(from: Column, to: Column) {
        const changedProperties = new Map<keyof Column, ColumnPropertyDiff>();

        if (from.scale !== to.scale) changedProperties.set('scale', new ColumnPropertyDiff(from.scale, to.scale));
        if (from.size !== to.size) changedProperties.set('size', new ColumnPropertyDiff(from.size, to.size));
        if (from.isNotNull !== to.isNotNull) changedProperties.set('isNotNull', new ColumnPropertyDiff(from.isNotNull, to.isNotNull));
        if (from.isAutoIncrement !== to.isAutoIncrement) changedProperties.set('isAutoIncrement', new ColumnPropertyDiff(from.isAutoIncrement, to.isAutoIncrement));
        if (from.defaultValue !== to.defaultValue) changedProperties.set('defaultValue', new ColumnPropertyDiff(from.defaultValue, to.defaultValue));

        return changedProperties;
    }
}

export class IndexComparator {
    static computeDiff(from: Index, to: Index) {
        //check if order has changed.
        const fromColumnNames = from.columns.map(v => v.name).join(',').toLowerCase();
        const toColumnNames = to.columns.map(v => v.name).join(',').toLowerCase();
        if (fromColumnNames !== toColumnNames) return true;

        return from.isUnique !== to.isUnique;
    }
}

export class ForeignKeyComparator {
    static computeDiff(from: ForeignKey, to: ForeignKey) {
        if (from.foreign.getName() !== to.foreign.getName()) return true;

        const fromFkLocalFields = from.localColumns.map(v => v.name).join(',').toLowerCase();
        const toFkLocalFields = to.localColumns.map(v => v.name).join(',').toLowerCase();
        if (fromFkLocalFields !== toFkLocalFields) return true;

        const fromFkForeignFields = from.localColumns.map(v => v.name).join(',').toLowerCase();
        const toFkForeignFields = to.localColumns.map(v => v.name).join(',').toLowerCase();
        if (fromFkForeignFields !== toFkForeignFields) return true;

        if (from.onUpdate.toLowerCase() !== to.onUpdate.toLowerCase()) return true;
        if (from.onDelete.toLowerCase() !== to.onDelete.toLowerCase()) return true;

        return false;
    }
}

export class TableDiff {
    public addedColumns = new Map<string, Column>();
    public removedColumns = new Map<string, Column>();
    public modifiedColumns = new Map<string, ColumnDiff>();
    public renamedColumns = new Map<string, [removed: Column, added: Column]>();

    public addedPKColumns = new Map<string, Column>();
    public removedPKColumns = new Map<string, Column>();
    public renamedPKColumns = new Map<string, [removed: Column, added: Column]>();

    public addedIndices = new Map<string, Index>();
    public removedIndices = new Map<string, Index>();
    public modifiedIndices = new Map<string, [from: Index, to: Index]>();

    public addedFKs = new Map<string, ForeignKey>();
    public modifiedFKs = new Map<string, [from: ForeignKey, to: ForeignKey]>();
    public removedFKs = new Map<string, ForeignKey>();

    constructor(public from: Table, public to: Table) {
    }

    hasModifiedPk(): boolean {
        return this.addedPKColumns.size > 0 || this.renamedPKColumns.size > 0 || this.removedPKColumns.size > 0;
    }

    hasModifiedColumns(): boolean {
        return this.addedColumns.size > 0 || this.renamedColumns.size > 0 || this.removedColumns.size > 0;
    }

    [inspect.custom]() {
        let lines: string[] = [];
        lines.push(`  ${this.from.getName()}:`);

        if (this.addedColumns.size) {
            lines.push('   addedColumns:');
            for (const field of this.addedColumns.values()) lines.push(`     ${field.getName()}:`);
        }

        if (this.removedColumns.size) {
            lines.push('   removedColumns:');
            for (const field of this.removedColumns.values()) lines.push(`     ${field.getName()}:`);
        }

        if (this.renamedColumns.size) {
            lines.push('   renamedColumns:');
            for (const [from, to] of this.renamedColumns.values()) lines.push(`     ${from.getName()} -> ${to.getName()}`);
        }

        if (this.modifiedColumns.size) {
            lines.push('   modifiedColumns:');
            for (const diff of this.modifiedColumns.values()) lines.push(`     ${diff.from.getName()}=>${diff.to.getName()} ${diff.valueOf()}`);
        }


        if (this.addedPKColumns.size) {
            lines.push('   addedPKColumns:');
            for (const field of this.addedPKColumns.values()) lines.push(`     ${field.getName()}:`);
        }

        if (this.removedPKColumns.size) {
            lines.push('   removedPKColumns:');
            for (const field of this.removedPKColumns.values()) lines.push(`     ${field.getName()}:`);
        }

        if (this.renamedPKColumns.size) {
            lines.push('   renamedPKColumns:');
            for (const [from, to] of this.renamedPKColumns.values()) lines.push(`     ${from.getName()} -> ${to.getName()}`);
        }


        if (this.addedFKs.size) {
            lines.push('   addedFKs:');
            for (const fk of this.addedFKs.values()) lines.push(`     ${fk.valueOf()}`);
        }

        if (this.modifiedFKs.size) {
            lines.push('   modifiedFKs:');
            for (const [from, to] of this.modifiedFKs.values()) {
                lines.push(`     ${from.getName()} => ${to.getName()}`);
                lines.push(`        ${from.getName()}: ${from.valueOf()}`);
                lines.push(`        ${to.getName()}: ${to.valueOf()}`);
            }
        }

        if (this.removedFKs.size) {
            lines.push('   removedFKs:');
            for (const fk of this.removedFKs.values()) lines.push(`     ${fk.getName()}`);
        }

        if (this.addedIndices.size) {
            lines.push('   addedIndices:');
            for (const index of this.addedIndices.values()) lines.push(`     ${index.valueOf()}`);
        }

        if (this.removedIndices.size) {
            lines.push('   removedIndices:');
            for (const index of this.removedIndices.values()) lines.push(`     ${index.valueOf()}`);
        }

        if (this.modifiedIndices.size) {
            lines.push('   modifiedIndices:');
            for (const [from, to] of this.modifiedIndices.values()) {
                lines.push(`     ${from.getName()} => ${to.getName()}`);
                lines.push(`        ${from.getName()}: ${from.valueOf()}`);
                lines.push(`        ${to.getName()}: ${to.valueOf()}`);
            }
        }

        return lines.join('\n');
    }
}

export class TableComparator {
    public readonly diff: TableDiff;

    constructor(public from: Table, public to: Table) {
        this.diff = new TableDiff(from, to);
    }

    static computeDiff(from: Table, to: Table): TableDiff | undefined {
        const tc = new this(from, to);

        let differences = 0;
        differences += tc.compareColumns();
        differences += tc.comparePrimaryKeys();
        differences += tc.compareIndices();
        differences += tc.compareFKs();

        return differences ? tc.diff : undefined;
    }

    protected compareColumns() {
        const fromColumns = this.from.columns;
        const toColumns = this.from.columns;
        let differences = 0;

        // check for new columns in $toEntity
        for (const column of toColumns) {
            if (!this.from.hasColumn(column.name)) {
                this.diff.addedColumns.set(column.name, column);
                differences++;
            }
        }

        // check for removed columns in $toEntity
        for (const column of fromColumns) {
            if (!this.to.hasColumn(column.name)) {
                this.diff.removedColumns.set(column.name, column);
                differences++;
            }
        }

        // check for column differences
        for (const fromColumn of fromColumns) {
            if (this.to.hasColumn(fromColumn.name)) {
                const toColumn = this.to.getColumn(fromColumn.name);
                const diff = ColumnComparator.computeDiff(fromColumn, toColumn);
                if (!diff) continue;
                console.log('column diff', fromColumn.getName(), diff);
                this.diff.modifiedColumns.set(fromColumn.name, diff);
                differences++;
            }
        }

        // check for column renamings
        for (const addedColumn of this.diff.addedColumns.values()) {
            for (const removedColumn of this.diff.removedColumns.values()) {
                if (!ColumnComparator.computeDiff(addedColumn, removedColumn)) {
                    // no difference except the name, that's probably a renaming
                    this.diff.renamedColumns.set(removedColumn.name, [removedColumn, addedColumn]);
                    this.diff.addedColumns.delete(addedColumn.name);
                    this.diff.removedColumns.delete(removedColumn.name);
                    differences--;

                    // skip to the next added column
                    break;
                }
            }
        }

        return differences;
    }

    protected comparePrimaryKeys() {
        const fromColumns = this.from.getPrimaryKeys();
        const toColumns = this.from.getPrimaryKeys();
        let differences = 0;

        // check for new columns in $toEntity
        for (const column of toColumns) {
            if (!this.from.hasColumn(column.name)) {
                this.diff.addedPKColumns.set(column.name, column);
                differences++;
            }
        }

        // check for removed columns in $toEntity
        for (const column of fromColumns) {
            if (!this.to.hasColumn(column.name)) {
                this.diff.removedPKColumns.set(column.name, column);
                differences++;
            }
        }

        // check for column renamings
        for (const addedColumn of this.diff.addedPKColumns.values()) {
            for (const removedColumn of this.diff.removedPKColumns.values()) {
                if (!ColumnComparator.computeDiff(addedColumn, removedColumn)) {
                    // no difference except the name, that's probably a renaming
                    this.diff.renamedPKColumns.set(removedColumn.name, [removedColumn, addedColumn]);
                    this.diff.addedPKColumns.delete(addedColumn.name);
                    this.diff.removedPKColumns.delete(removedColumn.name);
                    differences--;

                    // skip to the next added column
                    break;
                }
            }
        }

        return differences;
    }

    protected compareIndices() {
        let differences = 0;
        const fromIndices = this.from.indices.slice();
        const toIndices = this.to.indices.slice();

        for (const fromIndex of fromIndices.slice()) {
            for (const toIndex of toIndices.slice()) {
                if (fromIndex.getName() === toIndex.getName()) {
                    if (IndexComparator.computeDiff(fromIndex, toIndex)) {
                        //same name, but different columns
                        this.diff.modifiedIndices.set(fromIndex.name, [fromIndex, toIndex]);
                        differences++;
                    }

                    arrayRemoveItem(fromIndices, fromIndex);
                    arrayRemoveItem(toIndices, toIndex);
                }
            }
        }

        for (const fromIndex of fromIndices) {
            this.diff.removedIndices.set(fromIndex.name, fromIndex);
            differences++;
        }

        for (const toIndex of toIndices) {
            this.diff.addedIndices.set(toIndex.name, toIndex);
            differences++;
        }

        return differences;
    }

    protected compareFKs() {
        let differences = 0;
        const fromForeignKeys = this.from.foreignKeys.slice();
        const toForeignKys = this.to.foreignKeys.slice();

        for (const fromFK of fromForeignKeys.slice()) {
            for (const toFK of toForeignKys.slice()) {
                if (fromFK.getName() === toFK.getName()) {
                    if (ForeignKeyComparator.computeDiff(fromFK, toFK)) {
                        //same name, but different columns
                        this.diff.modifiedFKs.set(fromFK.name, [fromFK, toFK]);
                        differences++;
                    }

                    arrayRemoveItem(fromForeignKeys, fromFK);
                    arrayRemoveItem(toForeignKys, toFK);
                }
            }
        }

        for (const fromFK of fromForeignKeys) {
            this.diff.removedFKs.set(fromFK.name, fromFK);
            differences++;
        }

        for (const toFK of toForeignKys) {
            this.diff.addedFKs.set(toFK.name, toFK);
            differences++;
        }

        return differences;
    }
}
