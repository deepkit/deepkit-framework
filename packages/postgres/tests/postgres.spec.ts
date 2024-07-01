import { AutoIncrement, entity, PrimaryKey, Reference } from '@deepkit/type';
import { expect, test } from '@jest/globals';
import pg from 'pg';
import { databaseFactory } from './factory.js';

test('count', async () => {
    const pool = new pg.Pool({
        host: 'localhost',
        database: 'postgres',
        user: 'postgres',
    });

    pg.types.setTypeParser(1700, parseFloat);
    pg.types.setTypeParser(20, BigInt);

    (BigInt.prototype as any).toJSON = function() {
        return this.toString();
    };

    const connection = await pool.connect();

    {
        const count = (await connection.query('SELECT 1.55 as count')).rows[0].count;
        expect(count).toBe(1.55);
    }

    {
        const count = (await connection.query('SELECT COUNT(*) as count FROM (select 1) as tmp')).rows[0].count;
        expect(count).toBe(1n);
    }
});

test('bool and json', async () => {
    @entity.name('model1')
    class Model {
        id: number & PrimaryKey & AutoIncrement = 0;
        flag: boolean = false;
        doc: { flag: boolean } = { flag: false };
    }

    const database = await databaseFactory([]);
    database.registerEntity(Model);
    await database.adapter.createTables(database.entityRegistry);

    {
        const m = new Model;
        m.flag = true;
        m.doc.flag = true;
        await database.persist(m);
    }

    const m = await database.singleQuery(Model).findOne();
    expect(m).toMatchObject({ flag: true, doc: { flag: true } });
});

test('join', async () => {
    class User {
        id: number & PrimaryKey & AutoIncrement = 0;

        constructor(public name: string) {
        }

        group?: Group & Reference;
    }

    class Group {
        id: number & PrimaryKey & AutoIncrement = 0;

        constructor(public name: string) {
        }
    }

    const database = await databaseFactory([User, Group]);
    const groupAdmin = new Group('admin');
    const groupUser = new Group('user');
    const groups = [groupAdmin, groupUser];

    const count = 1000;
    const users: User[] = [];
    for (let i = 0; i < count; i++) {
        const group = groups[i % groups.length];
        const user = new User('User ' + i);
        user.group = group;
        users.push(user);
    }

    await database.persist(...groups, ...users);

    {
        const users = await database.query(User).find();
    }
});

// test('change different fields of multiple entities', async () => {
//     @entity.name('model2')
//     class Model {
//         firstName: string = '';
//         lastName: string = '';
//
//         constructor(public id: number & PrimaryKey) {
//         }
//     }
//
//     const database = await databaseFactory([Model]);
//
//     {
//         const m1 = new Model(1);
//         m1.firstName = 'Peter';
//         await database.persist(m1);
//         const m2 = new Model(2);
//         m2.lastName = 'Smith';
//         await database.persist(m2);
//     }
//
//     {
//         const m1 = await database.query(Model).filter({ id: 1 }).findOne();
//         const m2 = await database.query(Model).filter({ id: 2 }).findOne();
//
//         m1.firstName = 'Peter2';
//         m2.lastName = 'Smith2';
//         await database.persist(m1, m2);
//     }
//
//     {
//         const m1 = await database.query(Model).filter({ id: 1 }).findOne();
//         const m2 = await database.query(Model).filter({ id: 2 }).findOne();
//
//         expect(m1).toMatchObject({ id: 1, firstName: 'Peter2', lastName: '' });
//         expect(m2).toMatchObject({ id: 2, firstName: '', lastName: 'Smith2' });
//     }
// });
//
// test('change pk', async () => {
//     @entity.name('model3')
//     class Model {
//         firstName: string = '';
//
//         constructor(public id: number & PrimaryKey) {
//         }
//     }
//
//     const database = await databaseFactory([Model]);
//
//     {
//         const m1 = new Model(1);
//         m1.firstName = 'Peter';
//         await database.persist(m1);
//     }
//
//     {
//         const m1 = await database.query(Model).filter({ id: 1 }).findOne();
//         m1.id = 2;
//         await database.persist(m1);
//     }
//
//     {
//         const m1 = await database.query(Model).filter({ id: 2 }).findOne();
//         expect(m1).toMatchObject({ id: 2, firstName: 'Peter' });
//     }
//
//     {
//         const m1 = await database.query(Model).filter({ id: 2 }).findOne();
//         m1.id = 3;
//         m1.firstName = 'Peter2';
//         await database.persist(m1);
//     }
//
//     {
//         const m1 = await database.query(Model).filter({ id: 3 }).findOne();
//         expect(m1).toMatchObject({ id: 3, firstName: 'Peter2' });
//     }
// });
//
// test('for update/share', async () => {
//     @entity.name('model4')
//     class Model {
//         firstName: string = '';
//
//         constructor(public id: number & PrimaryKey) {
//         }
//     }
//
//     const database = await databaseFactory([Model]);
//     await database.persist(new Model(1), new Model(2));
//
//     {
//         const query = database.query(Model).forUpdate();
//         const sql = database.adapter.createSelectSql(query);
//         expect(sql.sql).toContain(' FOR UPDATE');
//     }
//
//     {
//         const query = database.query(Model).forShare();
//         const sql = database.adapter.createSelectSql(query);
//         expect(sql.sql).toContain(' FOR SHARE');
//     }
//
//     const items = await database.query(Model).forUpdate().find();
//     expect(items).toHaveLength(2);
// });
//
// test('json field and query', async () => {
//     @entity.name('product').collection('products')
//     class Product {
//         id: number & PrimaryKey & AutoIncrement = 0;
//         raw?: { [key: string]: any };
//     }
//
//     const database = await databaseFactory([Product]);
//
//     await database.persist(cast<Product>({ raw: { productId: 1, name: 'first' } }));
//     await database.persist(cast<Product>({ raw: { productId: 2, name: 'second' } }));
//
//     {
//         const res = await database.query(Product).filter({ 'raw.productId': 1 }).find();
//         expect(res).toMatchObject([{ id: 1, raw: { productId: 1, name: 'first' } }]);
//     }
//
//     {
//         const res = await database.query(Product).filter({ 'raw.productId': 2 }).find();
//         expect(res).toMatchObject([{ id: 2, raw: { productId: 2, name: 'second' } }]);
//     }
// });
//
// test('unique constraint 1', async () => {
//     class Model {
//         id: number & PrimaryKey & AutoIncrement = 0;
//
//         constructor(public username: string & Unique = '') {
//         }
//     }
//
//     const database = await databaseFactory([Model]);
//
//     await database.persist(new Model('peter'));
//     await database.persist(new Model('paul'));
//
//     {
//         const m1 = new Model('peter');
//         await expect(database.persist(m1)).rejects.toThrow('Key (username)=(peter) already exists');
//         await expect(database.persist(m1)).rejects.toBeInstanceOf(UniqueConstraintFailure);
//
//         try {
//             await database.persist(m1);
//         } catch (error: any) {
//             assertInstanceOf(error, UniqueConstraintFailure);
//             assertInstanceOf(error.cause, DatabaseInsertError);
//             assertInstanceOf(error.cause.cause, DatabaseError);
//             // error.cause.cause.cause is from the driver
//             expect(error.cause.cause.cause.table).toBe('Model');
//         }
//     }
//
//     {
//         const m1 = new Model('marie');
//         const m2 = new Model('marie');
//         await expect(database.persist(m1, m2)).rejects.toThrow('Key (username)=(marie) already exists');
//         await expect(database.persist(m1, m2)).rejects.toBeInstanceOf(UniqueConstraintFailure);
//     }
//
//     {
//         const m = await database.query(Model).filter({ username: 'paul' }).findOne();
//         m.username = 'peter';
//         await expect(database.persist(m)).rejects.toThrow('Key (username)=(peter) already exists');
//         await expect(database.persist(m)).rejects.toBeInstanceOf(UniqueConstraintFailure);
//     }
//
//     {
//         const p = database.query(Model).filter({ username: 'paul' }).patchOne({ username: 'peter' });
//         await expect(p).rejects.toThrow('Key (username)=(peter) already exists');
//         await expect(p).rejects.toBeInstanceOf(UniqueConstraintFailure);
//     }
// });
//
// test('vector embeddings', async () => {
//     @entity.name('vector_sentences')
//     class Sentences {
//         id: number & PrimaryKey & AutoIncrement = 0;
//         sentence: string = '';
//         embedding: Vector<3> = [];
//     }
//
//     const reflection = ReflectionClass.from(Sentences);
//     const embedding = reflection.getProperty('embedding');
//     console.log(getVectorTypeOptions(embedding.type));
//
//     const database = await databaseFactory([Sentences]);
//
//     const s1 = new Sentences;
//     s1.sentence = 'hello';
//     s1.embedding = [0, 0.5, 2];
//     await database.persist(s1);
//
//     const query = database.query(Sentences);
//
//     type ModelQuery<T> = {
//         [P in keyof T]?: string;
//     };
//
//     const q: ModelQuery<Sentences> = {} as any;
//
//     // count(q.sentence);
//     // sum(q.sentence);
//     //
//     // sort(l2Distance(q.embedding, [1, 2, 3]), 'asc');
//
//     const eq = (a: any, b: any): any => {};
//     const lt = (a: any, b: any): any => {};
//     const gt = (a: any, b: any): any => {};
//     const where = (a: any): any => {};
//     const select = <T>(a: (m: ModelQuery<T>) => any): any => {};
//     const groupBy = (...a: any[]): any => {};
//     const orderBy = (...a: any[]): any => {};
//     const count = (a: any): any => {};
//     const l2Distance = (a: any, b: any): any => {};
//
//     const join = (a: any, b: any): any => {};
//
//     select<Sentences>(m => {
//         where(eq(m.sentence, 'hello'));
//         return [m.id, m.sentence, count(m.sentence)];
//     });
//
//     const sentenceQuery = [123, 123, 123];
//     select<Sentences>(m => {
//         where(`${l2Distance(m.embedding, sentenceQuery)} > 0.5`);
//
//         // WHERE
//         //    embedding <=> ${sentenceQuery} > 0.5 AND group = 'abc'
//         // ORDER BY embedding <=> ${sentenceQuery}${asd ? ',' + asd : ''}
//
//         // where(lt(l2Distance(m.embedding, [1, 2, 3]), 0.5));
//         orderBy(l2Distance(m.embedding, sentenceQuery));
//         return [m.id, m.sentence, l2Distance(m.embedding, sentenceQuery)];
//     });
//
//     select<Sentences>(m => {
//         groupBy(m.sentence);
//         return [count(m.id)];
//     });
//
//     interface Group {
//         id: number;
//         name: string;
//     }
//
//     interface User {
//         id: number;
//         name: string;
//         groups: Group[];
//     }
//
//     select<User>(m => {
//         join(m.groups, g => {
//             return [g.id, g.name];
//         });
//         return [m.id, m.name, m.groups];
//     });
//
//     const rows = await database.query(Sentences)
//         .select(count(Sentences))
//         .filter({ embedding: { $l2Distance: { query: [2, 3, 4], filter: { $eq: 3.774917217635375 } } } })
//         .orderBy()
//         .find();
//
//     expect(rows).toHaveLength(1);
//     console.log(rows);
// });
