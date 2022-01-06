/*
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */

import { DatabaseModel, ForeignKey, IndexModel, parseType, SchemaParser, Table } from '@deepkit/sql';

export class MysqlSchemaParser extends SchemaParser {
    public defaultSchema = '';

    async parse(database: DatabaseModel, limitTableNames?: string[]) {
        if (!database.schemaName) {
            const row = await this.connection.execAndReturnSingle('SELECT DATABASE() as db');
            this.defaultSchema = row['db'];
        }

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
            FROM ${this.platform.quoteIdentifier(table.schemaName || this.defaultSchema)}
        `);

        let lastId: string | undefined;
        let index: IndexModel | undefined;
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
        SELECT distinct k.constraint_name as constraint_name,
        k.column_name as column_name, k.referenced_table_name as referenced_table_name, k.referenced_column_name as referenced_column_name,
        c.update_rule as update_rule, c.delete_rule as delete_rule
        from information_schema.key_column_usage k
        inner join information_schema.referential_constraints c on c.constraint_name = k.constraint_name and c.table_name = k.table_name
        where k.table_name = '${table.getName()}' and k.table_schema = database() and c.constraint_schema = database() and k.referenced_column_name is not null
        `);

        let lastId: string | undefined;
        let foreignKey: ForeignKey | undefined;
        for (const row of rows) {
            if (row.constraint_name !== lastId) {
                const foreignTable = database.getTableForFull(row.referenced_table_name, this.platform.getSchemaDelimiter());
                foreignKey = table.addForeignKey(row.constraint_name, foreignTable);
                lastId = row.constraint_name;
            }

            if (foreignKey) {
                foreignKey.addReference(row.column_name, row.referenced_column_name);
                foreignKey.onDelete = row.delete_rule;
                foreignKey.onUpdate = row.update_rule;
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
            SELECT table_name as table_name FROM information_schema.tables WHERE
            table_type = 'BASE TABLE' and table_schema = '${database.schemaName || this.defaultSchema}'
        `);

        for (const row of rows) {
            if (limitTableNames && !limitTableNames.includes(row.table_name)) continue;

            const table = database.addTable(row.table_name);
            table.schemaName = database.schemaName;
        }
    }
}
