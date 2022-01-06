import { Database, DatabaseEntityRegistry } from '@deepkit/orm';
import { ClassType } from '@deepkit/core';
import { SQLDatabaseAdapter } from '../src/sql-adapter';
import { DatabaseModel, TableComparator } from '../src/schema/table';
import { expect } from '@jest/globals';
import { ReflectionClass, Type } from '@deepkit/type';

export async function createSetup(adapter: SQLDatabaseAdapter, schemas: (ReflectionClass<any> | ClassType)[]) {
    const database = new Database(adapter);
    database.registerEntity(...schemas);
    await adapter.createTables(database.entityRegistry);

    return database;
}

export async function schemaMigrationRoundTrip(types: (Type | ClassType | ReflectionClass<any>)[], adapter: SQLDatabaseAdapter) {
    const originDatabaseModel = new DatabaseModel;
    adapter.platform.createTables(DatabaseEntityRegistry.from(types), originDatabaseModel);

    const db = new Database(adapter, types);
    const connection = await adapter.connectionPool.getConnection();

    try {
        await adapter.createTables(db.entityRegistry);
        const schemaParser = new adapter.platform.schemaParserType(connection, adapter.platform);

        // console.log(adapter.platform.getAddTablesDDL(originDatabaseModel));

        const readDatabaseModel = new DatabaseModel();
        await schemaParser.parse(readDatabaseModel, originDatabaseModel.getTableNames());
        expect(readDatabaseModel.tables.length).toBe(types.length);

        for (const type of types) {
            const s = ReflectionClass.from(type);
            const diff = TableComparator.computeDiff(originDatabaseModel.getTable(s.name!), readDatabaseModel.getTable(s.name!));
            if (diff) console.log('diff', s.getClassName(), diff);
            expect(diff).toBe(undefined);
        }

    } finally {
        connection.release();
        expect(adapter.connectionPool.getActiveConnections()).toBe(0);
        db.disconnect();
    }

}
