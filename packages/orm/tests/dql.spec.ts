import { expect, test } from '@jest/globals';
import { as, count, eq, groupBy, inArray, join, l2Distance, lower, lt, or, orderBy, query, Select, SelectorRefs, where } from '../src/select.js';
import { Database } from '../src/database.js';
import { AutoIncrement, BackReference, PrimaryKey, Reference, Vector } from '@deepkit/type';
import { MemoryDatabaseAdapter } from '../src/memory-db.js';

interface Group {
    id: number & AutoIncrement & PrimaryKey;
    name: string;
    users: User[] & BackReference;
}

interface User {
    id: number & AutoIncrement & PrimaryKey;
    name: string;
    group?: Group & Reference;
    birthday: Date;
}

test('basics', () => {
    function filterByAge(m: SelectorRefs<User>, age: number) {
    }

    // SELECT name, COUNT(id) FROM user
    // GROUP BY name
    const users = query((user: Select<User>) => {
        groupBy(user.name);
        return [user.name, count(user.id)];
    });

    // SELECT * FROM user
    // JOIN group ON (user.group_id = group.id AND name = 'Admin')
    // WHERE name = 'Peter'
    const users2 = query((user: Select<User>) => {
        join(user.group, group => {
            where(eq(group.name, 'Admin'));
        });
        where(eq(user.name, 'Peter'));
    });

    const users4 = query((user: Select<User>) => {
        return [user.id, lower(user.name)];
    });

    const users3 = query((user: Select<User>) => {
        return [user.id, user.name];
    });

    // from<User>().update(m => {
    //     set(m.name, 'asd');
    // });

    // SELECT * FROM group
    // JOIN user ON user.group_id = group.id
    // WHERE name = 'Admin' OR name = 'Moderator'
    const groups = query((group: Select<Group>) => {
        where(or(eq(group.name, 'Admin'), eq(group.name, 'Moderator')));
        // or
        where(inArray(group.name, ['Admin', 'Moderator']));

        join(group.users, users => {
            filterByAge(users, 30);
        });
    });

    // // SELECT age, COUNT(id) FROM user GROUP BY age
    // const ageGroup = query((user: Select<User>) => {
    //     groupBy(user.age);
    //     return [user.age, count(user.id)];
    // });
});

test('ideal world', async () => {
    // SELECT * FROM user
    // JOIN group ON group.id = user.group_id
    // WHERE group.name = 'Admin'
    // GROUP BY user.id
    // ORDER BY user.name
    // LIMIT 10
    // function userQuery(user: Select<User>) {
    //     const group = join(user.group);
    //     where(eq(group.name, 'Admin'));
    //     groupBy(user.id);
    //     orderBy(user.name);
    //     limit(10);
    //     return [user.id, user.name];
    // }
    //
    // const db = new Database(new MemoryDatabaseAdapter());
    // db.query2(userQuery);

    // const rows = await db.select(userQuery);
    // const rows = await db.select(userQuery).find();
    // const rows = await db.select(userQuery).findOne();
    // const rows = await db.select(userQuery).findOneOrUndefined();
    // const rows = await db.select(userQuery).findOneField();
    // const rows = await db.select(userQuery).findField();
    // const rows = await db.select(userQuery).patch();
    // const rows = await db.select(userQuery).patchMany();
    // const rows = await db.select(userQuery).delete();
    // const rows = await db.select(userQuery).deleteMany();
    //
    // const res1 = await db.update((user: Select<User>) => {
    //     set(user.name, 'asdasd');
    // });
    //
    // const res2 = await db.delete(userQuery);
});

test('vector search', () => {
    interface Sentence {
        id: number & AutoIncrement & PrimaryKey;
        sentence: string;
        embedding: Vector<256>;
    }

    const queryEmbedding = [1, 2, 3, 4];
    // SELECT *, (embedding <=> $1) as score
    // FROM sentence
    // WHERE embedding <=> $1 < 0.5
    // ORDER BY embedding <=> $1
    const sentences = query((sentence: Select<Sentence>) => {
        const score = l2Distance(sentence.embedding, queryEmbedding);
        where(lt(score, 0.5));
        orderBy(score);
        return [sentence, as(score, 'score')];
    });

    // const sentences2 = select<Sentence>(m => {
    //     const score = `${m.embedding} <=> $1`;
    //     where(`${score} < 0.5`);
    //     orderBy(score);
    //     return [m, `${score} as score`];
    // });
});

async function bench(title: string, cb: () => void) {
    const start = Date.now();
    const count = 100_000;

    for (let i = 0; i < count; i++) {
        await cb();
    }

    const took = Date.now() - start;
    const perSecond = count / (took / 1000);
    console.log(title, 'count', count.toLocaleString(), took, 'ms', 'avg', took / count, 'ms', 'per second', perSecond.toLocaleString(undefined, { maximumFractionDigits: 0 }));
}

test('asd', () => {
    query((m: Select<User>) => {
        const a = eq(m.name, 'Peter');
        const b = eq(m.name, 'Peter');
        const c = eq('Peter', m.name);
        const o = or(a, b);
        where(o, eq(m.name, 'Peter'));
    });
});

test('graph', () => {
    const a = query((m: Select<User>) => {
        where(eq(m.name, 'Peter1'));
    });

    const b = query((m: Select<User>) => {
        where(eq(m.name, 'Peter2'));
    });

    expect(a.state.where!.tree === b.state.where!.tree).toBe(true);

    function filterByAge(model: Select<{ birthday: Date }>, age: number) {
        const target = new Date();
        target.setFullYear(target.getFullYear() - age);
        where(lt(model.birthday, target));
    }

    const userIds = query((user: Select<User>) => {
        filterByAge(user, 30);
        return [user.id];
    });

    const result = query((user: Select<User>) => {
        const group = join(user.group);
        return [user.id, as(group.id, 'groupId')];
    });

    type Result = Pick<User, 'id'> & { group: Pick<Group, 'id'> };

    const result2: Result = {
        id: 0,
        group: { id: 0 },
    };

    // SELECT user.id, group.id as group_id FROM user
    // JOIN group ON group.id = user.group_id
    // const result3 = query((user: Select<User>) => {
    //     const group = join(user.group);
    //     return [user.id, pick(group, 'id')];
    // });
});

test('tree', () => {
    const a = query((m: Select<User>) => {
        where(eq(m.name, 'Peter1'));
    });

    const b = query((m: Select<User>) => {
        where(eq(m.name, 'Peter2'));
    });

    const c = query((m: Select<User>) => {
    });

    console.log(a.state.params, a.state.where);
    console.log(b.state.params, b.state.where);
    console.log(c.state.params, c.state.where);

    expect(a.state.where!.tree === b.state.where!.tree).toBe(true);
});

test('memory db', async () => {
    const db = new Database(new MemoryDatabaseAdapter());
    db.register<User>();

    const user1: User = { id: 1, name: 'Peter', birthday: new Date() };
    const user2: User = { id: 2, name: 'John', birthday: new Date() };
    const user3: User = { id: 3, name: 'Jane', birthday: new Date() };
    await db.persist(user1, user2, user3);

    {
        const user1 = await db.query2((user: Select<User>) => {
            where(eq(user.name, 'John'));
        }).findOne();
        expect(user1.name).toBe('John');

        const user2 = await db.query2((user: Select<User>) => {
            where(eq(user.name, 'Jane'));
        }).findOne();
        expect(user2.name).toBe('Jane');
    }
});

test('performance memory-db', async () => {
    const db = new Database(new MemoryDatabaseAdapter());
    db.register<User>();

    const user1: User = { id: 1, name: 'Peter', birthday: new Date() };
    const user2: User = { id: 2, name: 'John', birthday: new Date() };
    const user3: User = { id: 3, name: 'Jane', birthday: new Date() };
    await db.persist(user1, user2, user3);

    await bench('select', async () => {
        const res = await db.query2((user: Select<User>) => {
            where(eq(user.name, 'John'));
        }).find();
        if (res.length !== 1) throw new Error('Invalid result');
    });
});

test('performance state', async () => {
    await bench('select', () => {
        query((user: Select<User>) => {
            join(user.group, group => {
                where(eq(group.name, 'Admin'));
            });
            where(eq(user.name, 'Peter'));
            return [user.id, user.name];
        });
    });

    const database = new Database(new MemoryDatabaseAdapter());
    // database.select<User>(m => {
    //
    // });

    // bench('database', () => {
    //     database.query<User>()
    //         .select('id', 'name')
    //         .useJoin('group').filter({ name: 'Admin' }).end()
    //         .filter({ name: 'Peter' });
    // });
});
