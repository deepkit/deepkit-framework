import { ClassType } from '@deepkit/core';
import { SQLDatabaseAdapter } from './sql-adapter';
import { DatabaseModel, TableComparator } from './schema/table';
import { Database, DatabaseEntityRegistry } from '@deepkit/orm';
import { ReflectionClass, Type } from '@deepkit/type';
import { expect } from '@jest/globals';

export async function schemaMigrationRoundTrip(types: (Type | ClassType | ReflectionClass<any>)[], adapter: SQLDatabaseAdapter) {
    const originDatabaseModel = new DatabaseModel;
    adapter.platform.createTables(DatabaseEntityRegistry.from(types), originDatabaseModel);

    const db = new Database(adapter, types);
    await adapter.createTables(db.entityRegistry);

    const connection = await adapter.connectionPool.getConnection();
    let result = '';

    try {
        const schemaParser = new adapter.platform.schemaParserType(connection, adapter.platform);

        result = adapter.platform.getAddTablesDDL(originDatabaseModel).join('\n');
        // console.log(result);

        const readDatabaseModel = new DatabaseModel();
        await schemaParser.parse(readDatabaseModel, originDatabaseModel.getTableNames());
        expect(readDatabaseModel.tables.length).toBe(types.length);

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
        expect(adapter.connectionPool.getActiveConnections()).toBe(0);
        db.disconnect();
    }
    return result;
}
