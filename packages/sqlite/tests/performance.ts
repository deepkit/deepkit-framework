import { Database, eq, from, join, where } from '@deepkit/orm';
import { AutoIncrement, BackReference, PrimaryKey, Reference } from '@deepkit/type';
import { dynamicImport } from '@deepkit/core';
import { SQLiteDatabaseAdapter } from '../src/sqlite-adapter.js';

interface Group {
    id: number & AutoIncrement & PrimaryKey;
    name: string;
    users: User[] & BackReference;
}

interface User {
    id: number & AutoIncrement & PrimaryKey;
    name: string;
    age: number;
    group: Group & Reference;
}

const adapter = new SQLiteDatabaseAdapter(':memory:');
const database = new Database(adapter);

async function main() {
    const mitata = await dynamicImport('mitata') as typeof import('mitata');
    database.register<User>();
    database.register<Group>();
    await database.migrate();

    // mitata.group({ name: 'composition' }, () => {
    //     mitata.bench('new', () => {
    //         const query = database.select<User>(m => {
    //             join(m.group, group => {
    //                 where(eq(group.name, 'asd'));
    //             });
    //             where(eq(m.name, 'Peter1'));
    //         });
    //         const sql = emitSql(adapter, query.model);
    //         // console.log(sql, emitter.params);
    //     });
    //
    //     mitata.bench('old', () => {
    //         const query = database.query<User>()
    //             .useJoin('group').filter({ name: 'asd' }).end()
    //             .filter({ name: 'Peter1' });
    //         const builder = new SqlBuilder(adapter);
    //         const builtSQL = builder.build(ReflectionClass.from<User>(), query.model, 'SELECT');
    //         // expect(builtSQL.sql).toBe(`SELECT "User"."id", "User"."name", "User"."age", "User"."group" FROM "User"`);
    //     });
    // });

    mitata.group({ name: 'query' }, () => {
        mitata.bench('new', async () => {
            const query = database.singleQuery(from<User>(), m => {
                join(m.group, group => {
                    where(eq(group.name, 'asd'));
                });
                where(eq(m.name, 'Peter1'));
            });
            await query.find();
        });

        // mitata.bench('old', async () => {
        //     const query = database.query()
        //         .useJoin('group').filter({ name: 'asd' }).end()
        //         .filter({ name: 'Peter1' });
        //     await query.find();
        // });
    });

    await mitata.run();
}

void main();
