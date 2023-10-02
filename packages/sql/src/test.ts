import { ClassType } from '@deepkit/core';
import { SQLDatabaseAdapter } from './sql-adapter.js';
import { DatabaseModel, TableComparator } from './schema/table.js';
import { Database, DatabaseEntityRegistry } from '@deepkit/orm';
import { ReflectionClass, Type } from '@deepkit/type';

export async function schemaMigrationRoundTrip(types: (Type | ClassType | ReflectionClass<any>)[], adapter: SQLDatabaseAdapter) {
    const originDatabaseModel = new DatabaseModel([], adapter.getName());
    adapter.platform.createTables(DatabaseEntityRegistry.from(types), originDatabaseModel);

    const db = new Database(adapter, types);
    await adapter.createTables(db.entityRegistry);

    const connection = await adapter.connectionPool.getConnection();
    let result = '';

    try {
        const schemaParser = new adapter.platform.schemaParserType(connection, adapter.platform);

        result = adapter.platform.getAddTablesDDL(originDatabaseModel).join('\n');
        // console.log(result);

        const readDatabaseModel = new DatabaseModel([], adapter.getName());
        await schemaParser.parse(readDatabaseModel, originDatabaseModel.getTableNames());
        if (readDatabaseModel.tables.length !== types.length) throw new Error(`Read wrong table count, ${readDatabaseModel.tables.length} !== ${types.length}`);

        for (const type of types) {
            const s = ReflectionClass.from(type);
            const diff = TableComparator.computeDiff(originDatabaseModel.getTable(s.getCollectionName()), readDatabaseModel.getTable(s.getCollectionName()));
            if (diff) {
                console.log('diff', s.getClassName(), diff.toString());
                throw new Error(`Diff detected ${s.getClassName()}\n${diff.toString()}`);
            }
        }
    } finally {
        connection.release();
        if (adapter.connectionPool.getActiveConnections() !== 0) throw new Error(`Leaking adapter connections`);
        db.disconnect();
    }
    return result;
}
