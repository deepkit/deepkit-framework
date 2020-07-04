import {Database} from "../src/database";
import {Connection} from "../src/connection";

let database: Database;

export async function createDatabase(dbName: string): Promise<Database> {
    dbName = dbName.replace(/\s+/g, '-');
    const connection = new Connection('localhost', dbName);
    database = new Database(connection);
    await (await connection.connect()).db(dbName).dropDatabase();
    return database;
}
