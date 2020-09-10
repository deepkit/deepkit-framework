import {DefaultPlatform, isSet} from './default-platform';
import {postgresSerializer} from '../serializer/postgres-serializer';
import {Column, Database, Index, Table} from '../schema/table';

export class PostgresPlatform extends DefaultPlatform {
    protected defaultSqlType = 'TEXT';
    public readonly serializer = postgresSerializer;

    constructor() {
        super();

        this.addType('number', 'DOUBLE PRECISION');
        this.addType('date', 'timestamp');
        this.addType('moment', 'timestamp');
        this.addType('boolean', 'boolean');

        this.addType('class', 'jsonb');
        this.addType('array', 'jsonb');
        this.addType('union', 'jsonb');
        this.addType('partial', 'jsonb');
        this.addType('map', 'jsonb');
        this.addType('patch', 'jsonb');

        this.addType('uuid', 'uuid');
        this.addBinaryType('BYTEA');
    }

    getAddTablesDDL(database: Database): string[] {
        const ddl: string[] = [];

        ddl.push(this.getBeginDDL());
        ddl.push(this.getAddSchemasDDL(database));

        for (const table of database.tables) {
            ddl.push(this.getDropTableDDL(table));
            ddl.push(this.getAddTableDDL(table));
            ddl.push(this.getAddIndicesDDL(table));
        }

        for (const table of database.tables) {
            ddl.push(this.getAddForeignKeysDDL(table));
        }

        ddl.push(this.getEndDDL());

        return ddl.filter(isSet);
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

    supportsForeignKeyBlock(): boolean {
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