import {SQLConnection} from '../sql-adapter';
import {DefaultPlatform} from '../platform/default-platform';
import {Database, ForeignKey, Index, Table} from '../schema/table';
import {parseType} from './schema-parser';


export class PostgresSchemaParser {
    protected defaultPrecisions = {
        'char': 1,
        'character': 1,
        'integer': 32,
        'bigint': 64,
        'smallint': 16,
        'double precision': 54
    };

    constructor(
        protected connection: SQLConnection,
        protected platform: DefaultPlatform,
    ) {
    }

    async parse(database: Database) {
        await this.parseTables(database);

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
        select relname as constraint_name, attname as column_name, idx.indisunique as unique, idx.indisprimary as primary
        from pg_index idx
                 left join pg_class AS i on i.oid = idx.indexrelid
                 left join pg_attribute a on a.attrelid = idx.indrelid and a.attnum = ANY (idx.indkey) and a.attnum > 0
        where indrelid = '"${table.schemaName || 'public'}"."${table.getName()}"'::regclass
        `);

        let lastId: string | undefined;
        let index: Index | undefined;
        for (const row of rows) {
            if (row.constraint_name !== lastId) {
                if (row.primary) {
                    lastId = undefined;
                    table.getColumn(row.column_name).isPrimaryKey = true;
                    continue;
                }

                lastId = row.constraint_name;
                index = table.addIndex(row.constraint_name, row.unique);
            }

            if (index) {
                index.addColumn(row.column_name);
            }
        }
    }

    protected async addForeignKeys(database: Database, table: Table) {
        const rows = await this.connection.execAndReturnAll(`
        select kcu.table_name      as table_name,
               kcu.constraint_name as constraint_name,
               rel_kcu.table_name  as referenced_table_name,
               rel_kcu.constraint_schema  as referenced_schema_name,
               kcu.column_name     as column_name,
               rel_kcu.column_name as referenced_column_name,
               kcu.constraint_name,
               rco.update_rule,
               rco.delete_rule
        from information_schema.table_constraints tco
                 join information_schema.key_column_usage kcu
                      on tco.constraint_schema = kcu.constraint_schema
                          and tco.constraint_name = kcu.constraint_name
                 join information_schema.referential_constraints rco
                      on tco.constraint_schema = rco.constraint_schema
                          and tco.constraint_name = rco.constraint_name
                 join information_schema.key_column_usage rel_kcu
                      on rco.unique_constraint_schema = rel_kcu.constraint_schema
                          and rco.unique_constraint_name = rel_kcu.constraint_name
                          and kcu.ordinal_position = rel_kcu.ordinal_position
        where tco.table_name = '${table.getName()}'
          and tco.table_schema = '${table.schemaName || 'default'}'
          and tco.constraint_schema = tco.table_schema
          and tco.constraint_type = 'FOREIGN KEY'
        order by kcu.table_schema, kcu.table_name, kcu.ordinal_position
        `);

        let lastId: string | undefined;
        let foreignKey: ForeignKey | undefined;
        for (const row of rows) {
            if (row.constraint_name !== lastId) {
                lastId = row.constraint_name;
                const foreignTable = database.getTable(row.referenced_table_name, row.referenced_schema_name);
                foreignKey = table.addForeignKey(row.constraint_name, foreignTable);
            }

            if (foreignKey) {
                foreignKey.addReference(row.column_name, row.referenced_column_name);
                foreignKey.onUpdate = row.update_rule;
                foreignKey.onDelete = row.delete_rule;
            }
        }
    }

    protected async addColumns(table: Table) {
        const rows = await this.connection.execAndReturnAll(`
        SELECT
            column_name, data_type, column_default, is_nullable,
            numeric_precision, numeric_scale, character_maximum_length
        FROM information_schema.columns
        WHERE
            table_schema = '${table.schemaName}' AND table_name = '${table.getName()}'
        `);

        for (const row of rows) {
            const column = table.addColumn(row.column_name);
            parseType(column, row.data_type);
            const size = row.character_maximum_length || row.numeric_precision;
            const scale = row.numeric_scale;
            if (column.type && size !== this.defaultPrecisions[column.type]) {
                column.size = size;
            }

            if (scale) column.scale = scale;

            column.isNotNull = row.is_null === 'NO';

            if ('string' === typeof row.column_default) {
                if (row.column_default.includes('next(') && row.column_default.includes('::regclass')) {
                    column.isAutoIncrement = true;
                }
            }

            if (row.data_type.includes('SERIAL')) {
                column.isAutoIncrement = true;
            }
        }
    }

    protected async parseTables(database: Database) {
        const rows = await this.connection.execAndReturnAll(`
            select table_name, table_schema as schema_name
            from information_schema.tables where table_schema not like 'pg_%' and table_schema = current_schema()
            and table_name != 'geometry_columns' and table_name != 'spatial_ref_sys' and table_type != 'VIEW'
            and table_schema = '${database.schemaName || 'public'}' 
            order by table_name
        `);

        for (const row of rows) {
            const table = database.addTable(row.table_name);
            if (row.schema_name !== 'public') {
                table.schemaName = row.schema_name || database.schemaName;
            } else {
                table.schemaName = database.schemaName;
            }
        }
    }
}
