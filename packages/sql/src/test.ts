import { ClassType } from '@deepkit/core';
import { ClassSchema, getClassSchema } from '@deepkit/type';
import { SQLDatabaseAdapter } from './sql-adapter';
import { DatabaseModel, TableComparator } from './schema/table';
import { Database } from '@deepkit/orm';

export async function schemaMigrationRoundTrip(types: (ClassType | ClassSchema)[], adapter: SQLDatabaseAdapter) {
    const originDatabaseModel = new DatabaseModel;
    adapter.platform.createTables(types, originDatabaseModel);

    const db = new Database(adapter, types);
    await adapter.createTables([...db.entities]);

    const connection = await adapter.connectionPool.getConnection();
    try {
        const schemaParser = new adapter.platform.schemaParserType(connection, adapter.platform);

        const readDatabaseModel = new DatabaseModel();
        await schemaParser.parse(readDatabaseModel, originDatabaseModel.getTableNames());

        for (const type of types) {
            const s = getClassSchema(type);
            const diff = TableComparator.computeDiff(originDatabaseModel.getTable(s.name!), readDatabaseModel.getTable(s.name!));
            if (diff) console.log('diff', s.getClassName(), diff);
        }

    } finally {
        connection.release();
        db.disconnect();
    }

}
