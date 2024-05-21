import { Database, eq, join, where } from '@deepkit/orm';
import { adapter, MyAdapter } from './my-platform.js';
import { SqlBuilder } from '../src/sql-builder.js';
import { AutoIncrement, BackReference, PrimaryKey, Reference, ReflectionClass } from '@deepkit/type';
import { dynamicImport } from '@deepkit/core';

interface Role {
    id: number & AutoIncrement & PrimaryKey;
    name: string;
}

interface GroupRole {
    id: number & AutoIncrement & PrimaryKey;
    group: Group & Reference;
    role: Role & Reference;
}

interface Group {
    id: number & AutoIncrement & PrimaryKey;
    name: string;
    users: User[] & BackReference;
    roles: Role[] & BackReference<{via: GroupRole}>;
}

interface User {
    id: number & AutoIncrement & PrimaryKey;
    name: string;
    age: number;
    group: Group & Reference;
}

const database = new Database(new MyAdapter);

async function main() {
    /** @type {typeof import('mitata')} */
    const mitata = await dynamicImport('mitata');

    // User without group
    const query1 = await database.from<User>().find(user => {
        join(user.group, group => {
            where(eq(group.name, 'Admin'));
        });
    }).find();

    // User with group
    const query2 = database.from<User>().select(user => {
        join(user.group, group => {
            where(eq(group.name, 'Admin'));
        });
        return [user, user.group];
    });

    //User with group name
    const query3 = database.from<User>().find(user => {
        join(user.group, group => {
            where(eq(group.name, 'Admin'));
        });
        return [user, user.group.name];
    });

    //User with group and roles
    const query4 = database.from<User>().select(user => {
        join(user.group, group => {
            where(eq(group.name, 'Admin'));
        });
        join(user.group);
        return [user, user.group, user.group.roles]; //creates implicit join
    });

    mitata.group({ name: 'query' }, () => {
        mitata.bench('select', () => {
            const query = database.from<User>().select(user => {
                const group = join(user.group, group => {
                    where(eq(group.name, 'asd'));
                });

                where(eq(user.name, 'Peter1'));
                where(eq(user.name, user.group.name));

                //TODO what is the best API here?
                //  When to include the join columns in the select?
                return [user, group];
            });

            const sql = emitSql(adapter, query.model);
            // console.log(sql, emitter.params);
        });

        mitata.bench('query', () => {
            const query = database.query<User>()
                .useJoin('group').filter({ name: 'asd' }).end()
                .filter({ name: 'Peter1' });
            const builder = new SqlBuilder(adapter);
            const builtSQL = builder.build(ReflectionClass.from<User>(), query.model, 'SELECT');
            // expect(builtSQL.sql).toBe(`SELECT "User"."id", "User"."name", "User"."age", "User"."group" FROM "User"`);
        });
    });

    await mitata.run();
}

void main();
