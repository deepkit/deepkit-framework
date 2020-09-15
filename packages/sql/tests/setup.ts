import {Database} from '@deepkit/orm';
import {ClassSchema, getClassSchema} from '@deepkit/type';
import {ClassType} from '@deepkit/core';
import {SQLDatabaseAdapter} from '../index';
import {SchemaParser} from '../src/reverse/schema-parser';
import {DatabaseModel, TableComparator} from '../src/schema/table';

export async function createSetup(adapter: SQLDatabaseAdapter, schemas: (ClassSchema | ClassType)[]) {
    const database = new Database(adapter);
    database.registerEntity(...schemas);
    await database.migrate();

    return database;
}

export async function schemaMigrationRoundTrip(types: (ClassType | ClassSchema)[], adapter: SQLDatabaseAdapter, schemaParserType: ClassType<SchemaParser>) {
    const originDatabaseModel = new DatabaseModel;
    adapter.platform.createTables(types, originDatabaseModel);

    const db = new Database(adapter, types);
    await db.migrate();
    const connection = await adapter.connectionPool.getConnection();
    const schemaParser = new schemaParserType(connection, adapter.platform);

    console.log(adapter.platform.getAddTablesDDL(originDatabaseModel));

    const readDatabaseModel = new DatabaseModel();
    await schemaParser.parse(readDatabaseModel, originDatabaseModel.getTableNames());
    expect(readDatabaseModel.tables.length).toBe(types.length);

    connection.release();
    db.disconnect(true);

    for (const type of types) {
        const s = getClassSchema(type)
        const diff = TableComparator.computeDiff(originDatabaseModel.getTable(s.name!), readDatabaseModel.getTable(s.name!));
        if (diff) console.log('diff', s.getClassName(), diff);
        expect(diff).toBe(undefined);
    }
}
