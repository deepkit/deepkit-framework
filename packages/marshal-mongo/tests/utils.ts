// let database: Database;
//
// export async function createDatabase(dbName: string): Promise<Database> {
//     dbName = dbName.replace(/\s+/g, '-');
//     const connection = new Connection('localhost', dbName);
//     database = new Database(connection);
//     await (await connection.connect()).db(dbName).dropDatabase();
//     return database;
// }
/**
 * Executes given exec() method 3 times and averages the consumed time.
 */
export async function bench(times: number, title: string, exec: (i: number) => Promise<void> | void) {
    const start = performance.now();

    for (let i = 0; i < times; i++) {
        await exec(i);
    }

    const took = performance.now() - start;

    console.log(times, 'x benchmark', title, took, 'ms', took / times, 'per item');
}
