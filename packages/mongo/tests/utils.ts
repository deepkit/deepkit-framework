import {Database} from "..";
import {createConnection} from "typeorm";

let database: Database;

export async function createDatabase(dbName: string): Promise<Database> {
    dbName = dbName.replace(/\s+/g, '-');
    const connection = await createConnection({
        name: dbName,
        type: "mongodb",
        host: "localhost",
        port: 27017,
        database: "test",
        useNewUrlParser: true,
    });
    database = new Database(connection, dbName);
    await database.dropDatabase(dbName);
    return database;
}
