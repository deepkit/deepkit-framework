import {DatabaseModel, ForeignKey, Index, Table} from '../schema/table';
import {parseType, SchemaParser} from './schema-parser';


export class MysqlSchemaParser extends SchemaParser {
    async parse(database: DatabaseModel, limitTableNames?: string[]) {
        await this.parseTables(database, limitTableNames);

        for (const table of database.tables) {
            await this.addColumns(table);
        }

        for (const table of database.tables) {
            await this.addIndexes(table);
            await this.addForeignKeys(database, table);
        }
    }

    protected async addIndexes(table: Table) {
        const rows = await this.connection.execAndReturnAll(`
            SHOW INDEX FROM ${this.platform.quoteIdentifier(table.getName())}
            FROM ${this.platform.quoteIdentifier(table.schemaName || 'default')}
        `);

        let lastId: string | undefined;
        let index: Index | undefined;
        for (const row of rows) {
            if (row.Key_name === 'PRIMARY') {
                const column = table.getColumn(row.Column_name);
                column.isPrimaryKey = true;
                lastId = undefined;
                continue;
            }

            const unique = !row.Non_unique;
            if (lastId !== row.Key_name) {
                index = table.addIndex(row.Key_name, unique);
                lastId = row.Key_name;
            }

            if (index) index.addColumn(row.Column_name);
        }
    }

    protected async addForeignKeys(database: DatabaseModel, table: Table) {
        const rows = await this.connection.execAndReturnAll(`
        SELECT distinct k.constraint_name, k.column_name, k.referenced_table_name, k.referenced_column_name, c.update_rule, c.delete_rule
        from information_schema.key_column_usage k
        inner join information_schema.referential_constraints c on c.constraint_name = k.constraint_name and c.table_name = '${table.getName()}'
        where k.table_name = '${table.getName()}' and k.table_schema = database() and c.constraint_schema = database() and k.referenced_column_name is not null 
        `);

        let lastId: string | undefined;
        let foreignKey: ForeignKey | undefined;
        for (const row of rows) {
            if (row.CONSTRAINT_NAME !== lastId) {
                const foreignTable = database.getTableForFull(row.REFERENCED_TABLE_NAME, this.platform.getSchemaDelimiter());
                foreignKey = table.addForeignKey(row.CONSTRAINT_NAME, foreignTable);
                lastId = row.CONSTRAINT_NAME;
            }

            if (foreignKey) {
                foreignKey.addReference(row.COLUMN_NAME, row.REFERENCED_COLUMN_NAME);
                foreignKey.onDelete = row.DELETE_RULE;
                foreignKey.onUpdate = row.UPDATE_RULE;
            }
        }
    }

    protected async addColumns(table: Table) {
        const rows = await this.connection.execAndReturnAll(`
            SHOW COLUMNS FROM ${this.platform.quoteIdentifier(table.getName())}
        `);

        for (const row of rows) {
            const column = table.addColumn(row.Field);
            parseType(column, row.Type);

            column.isNotNull = row.Null === 'NO';
            column.defaultValue = row.Default || undefined;

            if (row.Key === 'PRI') column.isPrimaryKey = true;
            if ('string' === typeof row.Extra) {
                if (row.Extra.includes('auto_increment')) column.isAutoIncrement = true;
            }
        }
    }

    protected async parseTables(database: DatabaseModel, limitTableNames?: string[]) {
        const rows = await this.connection.execAndReturnAll(`
            SELECT table_name FROM information_schema.tables WHERE
            table_type = 'BASE TABLE' and table_schema = '${database.schemaName || 'default'}'
        `);

        for (const row of rows) {
            if (limitTableNames && !limitTableNames.includes(row.TABLE_NAME)) continue;

            const table = database.addTable(row.TABLE_NAME);
            table.schemaName = database.schemaName;
        }
    }
}
