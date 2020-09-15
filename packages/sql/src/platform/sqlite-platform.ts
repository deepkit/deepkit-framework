import {DefaultPlatform, isSet} from './default-platform';
import {Column, ForeignKey, Table} from '../schema/table';
import {PropertySchema} from '@deepkit/type/dist/src/decorators';
import {parseType} from '../reverse/schema-parser';
import {SqliteOptions} from '@deepkit/type';

export class SQLitePlatform extends DefaultPlatform {
    protected defaultSqlType = 'text';

    constructor() {
        super();

        this.addType('number', 'integer', 8);
        this.addType('date', 'integer', 8);
        this.addType('moment', 'integer', 8);
        this.addType('boolean', 'integer', 1);
        this.addType('uuid', 'blob');
        this.addBinaryType('blob');
    }

    protected setColumnType(column: Column, typeProperty: PropertySchema) {
        const db = (typeProperty.data['sqlite'] || {}) as SqliteOptions;
        if (db.type) {
            parseType(column, db.type);
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
