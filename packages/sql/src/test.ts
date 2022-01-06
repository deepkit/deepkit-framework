import { ClassType } from '@deepkit/core';
import { SQLDatabaseAdapter } from './sql-adapter';
import { DatabaseModel, TableComparator } from './schema/table';
import { Database, DatabaseEntityRegistry } from '@deepkit/orm';
import { ReflectionClass, Type } from '@deepkit/type';

export async function schemaMigrationRoundTrip(types: (Type | ClassType | ReflectionClass<any>)[], adapter: SQLDatabaseAdapter) {
    const originDatabaseModel = new DatabaseModel;
    adapter.platform.createTables(DatabaseEntityRegistry.from(types), originDatabaseModel);

    const db = new Database(adapter, types);
    await adapter.createTables(db.entityRegistry);

    const connection = await adapter.connectionPool.getConnection();
    try {
        const schemaParser = new adapter.platform.schemaParserType(connection, adapter.platform);

        const readDatabaseModel = new DatabaseModel();
        await schemaParser.parse(readDatabaseModel, originDatabaseModel.getTableNames());

        for (const type of types) {
            const s = ReflectionClass.from(type);
            const diff = TableComparator.computeDiff(originDatabaseModel.getTable(s.name!), readDatabaseModel.getTable(s.name!));
            if (diff) console.log('diff', s.getClassName(), diff);
        }

    } finally {
        connection.release();
        db.disconnect();
    }

}
