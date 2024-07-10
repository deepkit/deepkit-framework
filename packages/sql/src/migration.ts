import { DatabaseEntityRegistry, DatabaseError } from '@deepkit/orm';
import { DatabaseModel } from './schema/table.js';
import { DefaultPlatform } from './platform/default-platform.js';

/**
 * Creates (and re-creates already existing) tables in the database.
 * This is only for testing purposes useful.
 *
 * WARNING: THIS DELETES ALL AFFECTED TABLES AND ITS CONTENT.
 */
export async function createTables(
    entityRegistry: DatabaseEntityRegistry,
    pool: { getConnection(): Promise<{ run(sql: string): Promise<any>; release(): void }> },
    platform: DefaultPlatform,
    adapter: { getName(): string, getSchemaName(): string },
): Promise<void> {
    const connection = await pool.getConnection();
    try {
        const database = new DatabaseModel([], adapter.getName());
        database.schemaName = adapter.getSchemaName();
        platform.createTables(entityRegistry, database);
        const DDLs = platform.getAddTablesDDL(database);
        for (const sql of DDLs) {
            try {
                await connection.run(sql);
            } catch (error) {
                throw new DatabaseError(`Could not create table: ${error}\n${sql}`, { cause: error });
            }
        }
    } finally {
        connection.release();
    }
}
