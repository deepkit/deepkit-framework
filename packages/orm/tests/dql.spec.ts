import { expect, test } from '@jest/globals';
import { as, count, eq, from, groupBy, groupConcat, inArray, join, l2Distance, lower, lt, or, orderBy, SelectorRefs, where } from '../src/select.js';
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
    age: number;
    group: Group & Reference;
}

test('basics', () => {
    function filterByAge(m: SelectorRefs<User>, age: number) {
    }

    const users = from<User>().select(user => {
        const group = join(user.group, group => {
            where(eq(group.name, 'Admin'));
        });
        where(eq(user.name, 'Peter'));
        groupBy(user.id);
        return [user.id, user.name, groupConcat(group.name)];
    });

    // SELECT * FROM user
    // JOIN group ON (user.group_id = group.id AND name = 'Admin')
    // WHERE name = 'Peter'
    const users2 = from<User>().select(user => {
        join(user.group, group => {
            where(eq(group.name, 'Admin'));
        });
        where(eq(user.name, 'Peter'));
    });

    const users4 = from<User>().select(user => {
        return [user.id, lower(user.name)];
    });

    const users3 = from<User>().select(m => {
        return [m.id, m.name];
    });

    // from<User>().update(m => {
    //     set(m.name, 'asd');
    // });

    // SELECT * FROM group
    // JOIN user ON user.group_id = group.id
    // WHERE name = 'Admin' OR name = 'Moderator'
    const groups = from<Group>().select(group => {
        where(or(eq(group.name, 'Admin'), eq(group.name, 'Moderator')));
        // or
        where(inArray(group.name, ['Admin', 'Moderator']));

        join(group.users, users => {
            filterByAge(users, 30);
        });
    });

    // SELECT age, COUNT(id) FROM user GROUP BY age
    const ageGroup = from<User>().select(user => {
        groupBy(user.age);
        return [user.age, count(user.id)];
    });
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
    const sentences = from<Sentence>().select(sentence => {
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

function bench(title: string, cb: () => void) {
    const start = Date.now();
    const count = 100_000;

    for (let i = 0; i < count; i++) {
        cb();
    }

    const took = Date.now() - start;
    const perSecond = count / (took / 1000);
    console.log(title, 'count', count.toLocaleString(), took, 'ms', 'avg', took / count, 'ms', 'per second', perSecond.toLocaleString(undefined, { maximumFractionDigits: 0 }));
}

test('asd', () => {
    from<User>().select(m => {
        const a = eq(m.name, 'Peter');
        const b = eq(m.name, 'Peter');
        const c = eq('Peter', m.name);
        const o = or(a, b);
        where(o, eq(m.name, 'Peter'));
    });
});

test('graph', () => {
    const a = from<User>().select(m => {
        where(eq(m.name, 'Peter1'));
    });

    const b = from<User>().select(m => {
        where(eq(m.name, 'Peter2'));
    });

    console.log(a.state.params, b.state.where);
    console.log(b.state.params, a.state.where);

    expect(a.state.where!.graph === b.state.where!.graph).toBe(true);
});

test('performance', () => {
    bench('select', () => {
        from<User>().select(user => {
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

    bench('database', () => {
        database.query<User>()
            .select('id', 'name')
            .useJoin('group').filter({ name: 'Admin' }).end()
            .filter({ name: 'Peter' });
    });
});
