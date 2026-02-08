import { Database } from '@deepkit/orm';
import { DatabaseFactory } from '@deepkit/orm-integration';

import { MySQLDatabaseAdapter } from '../src/mysql-adapter.js';

export const databaseFactory: DatabaseFactory<MySQLDatabaseAdapter> = async (
    entities,
    plugins,
): Promise<Database<MySQLDatabaseAdapter>> => {
    const adapter = new MySQLDatabaseAdapter({
        host: process.env.MYSQL_HOST || '127.0.0.1',
        port: parseInt(process.env.MYSQL_PORT || '13306', 10),
        database: process.env.MYSQL_DB || 'default',
        user: process.env.MYSQL_USER || 'root',
        password: process.env.MYSQL_PW || process.env.MYSQL_PASSWORD,
    });

    const database = new Database(adapter);
    if (entities) database.registerEntity(...entities);
    if (plugins) database.registerPlugin(...plugins);
    await adapter.createTables(database.entityRegistry);

    return database;
};
