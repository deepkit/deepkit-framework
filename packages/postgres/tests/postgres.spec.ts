import { expect, test } from '@jest/globals';
import pg from 'pg';

import { assertInstanceOf } from '@deepkit/core';
import { ConsoleLogger } from '@deepkit/logger';
import { DatabaseError, DatabaseInsertError, UniqueConstraintFailure } from '@deepkit/orm';
import { AutoIncrement, DatabaseField, PrimaryKey, UUID, Unique, cast, entity, uuid } from '@deepkit/type';

import { databaseFactory } from './factory.js';

test('count', async () => {
    const pool = new pg.Pool({
        host: process.env.POSTGRES_HOST || 'localhost',
        port: parseInt(process.env.POSTGRES_PORT || '15432', 10),
        database: process.env.POSTGRES_DB || 'postgres',
        user: process.env.POSTGRES_USER || 'postgres',
        password: process.env.POSTGRES_PASSWORD || undefined,
    });

    pg.types.setTypeParser(1700, parseFloat);
    pg.types.setTypeParser(20, BigInt);

    (BigInt.prototype as any).toJSON = function () {
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

    const database = await databaseFactory([Model]);

    {
        const m = new Model();
        m.flag = true;
        m.doc.flag = true;
        await database.persist(m);
    }

    const m = await database.query(Model).findOne();
    expect(m).toMatchObject({ flag: true, doc: { flag: true } });
});

test('change different fields of multiple entities', async () => {
    @entity.name('model2')
    class Model {
        firstName: string = '';
        lastName: string = '';

        constructor(public id: number & PrimaryKey) {}
    }

    const database = await databaseFactory([Model]);

    {
        const m1 = new Model(1);
        m1.firstName = 'Peter';
        await database.persist(m1);
        const m2 = new Model(2);
        m2.lastName = 'Smith';
        await database.persist(m2);
    }

    {
        const m1 = await database.query(Model).filter({ id: 1 }).findOne();
        const m2 = await database.query(Model).filter({ id: 2 }).findOne();

        m1.firstName = 'Peter2';
        m2.lastName = 'Smith2';
        await database.persist(m1, m2);
    }

    {
        const m1 = await database.query(Model).filter({ id: 1 }).findOne();
        const m2 = await database.query(Model).filter({ id: 2 }).findOne();

        expect(m1).toMatchObject({ id: 1, firstName: 'Peter2', lastName: '' });
        expect(m2).toMatchObject({ id: 2, firstName: '', lastName: 'Smith2' });
    }
});

test('change pk', async () => {
    @entity.name('model3')
    class Model {
        firstName: string = '';

        constructor(public id: number & PrimaryKey) {}
    }

    const database = await databaseFactory([Model]);

    {
        const m1 = new Model(1);
        m1.firstName = 'Peter';
        await database.persist(m1);
    }

    {
        const m1 = await database.query(Model).filter({ id: 1 }).findOne();
        m1.id = 2;
        await database.persist(m1);
    }

    {
        const m1 = await database.query(Model).filter({ id: 2 }).findOne();
        expect(m1).toMatchObject({ id: 2, firstName: 'Peter' });
    }

    {
        const m1 = await database.query(Model).filter({ id: 2 }).findOne();
        m1.id = 3;
        m1.firstName = 'Peter2';
        await database.persist(m1);
    }

    {
        const m1 = await database.query(Model).filter({ id: 3 }).findOne();
        expect(m1).toMatchObject({ id: 3, firstName: 'Peter2' });
    }
});

test('for update/share', async () => {
    @entity.name('model4')
    class Model {
        firstName: string = '';

        constructor(public id: number & PrimaryKey) {}
    }

    const database = await databaseFactory([Model]);
    await database.persist(new Model(1), new Model(2));

    {
        const query = database.query(Model).forUpdate();
        const sql = database.adapter.createSelectSql(query);
        expect(sql.sql).toContain(' FOR UPDATE');
    }

    {
        const query = database.query(Model).forShare();
        const sql = database.adapter.createSelectSql(query);
        expect(sql.sql).toContain(' FOR SHARE');
    }

    const items = await database.query(Model).forUpdate().find();
    expect(items).toHaveLength(2);
});

test('json field and query', async () => {
    @(entity.name('product').collection('products'))
    class Product {
        id: number & PrimaryKey & AutoIncrement = 0;
        raw?: { [key: string]: any };
    }

    const database = await databaseFactory([Product]);

    await database.persist(cast<Product>({ raw: { productId: 1, name: 'first' } }));
    await database.persist(cast<Product>({ raw: { productId: 2, name: 'second' } }));

    {
        const res = await database.query(Product).filter({ 'raw.productId': 1 }).find();
        expect(res).toMatchObject([{ id: 1, raw: { productId: 1, name: 'first' } }]);
    }

    {
        const res = await database.query(Product).filter({ 'raw.productId': 2 }).find();
        expect(res).toMatchObject([{ id: 2, raw: { productId: 2, name: 'second' } }]);
    }
});

test('unique constraint 1', async () => {
    class Model {
        id: number & PrimaryKey & AutoIncrement = 0;

        constructor(public username: string & Unique = '') {}
    }

    const database = await databaseFactory([Model]);

    await database.persist(new Model('peter'));
    await database.persist(new Model('paul'));

    {
        const m1 = new Model('peter');
        await expect(database.persist(m1)).rejects.toThrow('Key (username)=(peter) already exists');
        await expect(database.persist(m1)).rejects.toBeInstanceOf(UniqueConstraintFailure);

        try {
            await database.persist(m1);
        } catch (error: any) {
            assertInstanceOf(error, UniqueConstraintFailure);
            expect(error.code).toBe('DK-O100'); // UniqueConstraintFailure error code
            assertInstanceOf(error.cause, DatabaseInsertError);
            expect(error.cause.code).toBe('DK-O010'); // DatabaseInsertError error code
            assertInstanceOf(error.cause.cause, DatabaseError);
            expect(error.cause.cause.code).toBe('DK-O001'); // DatabaseError base code
            // error.cause.cause.cause is from the driver
            expect((error.cause.cause.cause as any).table).toBe('Model');
        }
    }

    {
        const m1 = new Model('marie');
        const m2 = new Model('marie');
        await expect(database.persist(m1, m2)).rejects.toThrow('Key (username)=(marie) already exists');
        await expect(database.persist(m1, m2)).rejects.toBeInstanceOf(UniqueConstraintFailure);
    }

    {
        const m = await database.query(Model).filter({ username: 'paul' }).findOne();
        m.username = 'peter';
        await expect(database.persist(m)).rejects.toThrow('Key (username)=(peter) already exists');
        await expect(database.persist(m)).rejects.toBeInstanceOf(UniqueConstraintFailure);
    }

    {
        const p = database.query(Model).filter({ username: 'paul' }).patchOne({ username: 'peter' });
        await expect(p).rejects.toThrow('Key (username)=(peter) already exists');
        await expect(p).rejects.toBeInstanceOf(UniqueConstraintFailure);
    }
});

test('database field name with filter', async () => {
    class User {
        constructor(public id: UUID & PrimaryKey & DatabaseField<{ name: 'uuid' }>) {}
    }

    const database = await databaseFactory([User]);

    const user = new User(uuid());

    await database.persist(user);

    {
        const dbUser = await database.query(User).filterField('id', user.id).findOne();
        expect(dbUser.id).toEqual(user.id);
    }
});

test('json array', async () => {
    type Block = { type: string; data: any };

    class Model {
        id: number & PrimaryKey & AutoIncrement = 0;
        blocks: any[] = [];
        createdAt: Date = new Date();
        updatedAt: Date = new Date();

        publishedAt: Date = new Date(0);
        published: boolean = false;

        slug: string = '';
        title: string = '';
    }

    const database = await databaseFactory([Model]);
    const logger = new ConsoleLogger();
    logger.setLevel('debug');
    database.setLogger(logger);

    {
        const model = new Model();
        model.title = '13';
        model.blocks = [{ type: 'a', data: { yes: 1 } }];
        await database.persist(model);
    }

    {
        const model = await database.query(Model).findOne();
        model.title = '14';
        model.blocks = [
            { type: 'a', data: { yes: 0 } },
            { type: 'a', data: { no: '23' } },
        ];
        await database.persist(model);
    }
    {
        const model = await database.query(Model).findOne();
        expect(model.title).toBe('14');
        expect(model.blocks.length).toEqual(2);
    }
});

test('count with pagination returns total count (#668)', async () => {
    // GitHub issue #668: query.count() throws error if used with query pagination for page > 1
    // count() should return the total number of matching rows, ignoring limit/skip
    class Item {
        id: number & PrimaryKey & AutoIncrement = 0;
        constructor(public name: string = '') {}
    }

    const database = await databaseFactory([Item]);

    // Insert 25 items
    for (let i = 0; i < 25; i++) {
        await database.persist(new Item(`Item ${i + 1}`));
    }

    // Test 1: count without pagination returns total
    expect(await database.query(Item).count()).toBe(25);

    // Test 2: count with pagination still returns total (this was the bug)
    const query = database.query(Item).itemsPerPage(10).page(1);
    const [page1Items, total1] = await Promise.all([query.find(), query.count()]);
    expect(page1Items.length).toBe(10);
    expect(total1).toBe(25); // count should return total, not paginated count

    // Test 3: page 2 - this is where the bug manifested (page > 1)
    const query2 = database.query(Item).itemsPerPage(10).page(2);
    const [page2Items, total2] = await Promise.all([query2.find(), query2.count()]);
    expect(page2Items.length).toBe(10);
    expect(total2).toBe(25); // count should still return total

    // Test 4: page 3 (last page with only 5 items)
    const query3 = database.query(Item).itemsPerPage(10).page(3);
    const [page3Items, total3] = await Promise.all([query3.find(), query3.count()]);
    expect(page3Items.length).toBe(5);
    expect(total3).toBe(25); // count should still return total

    // Test 5: page beyond data (page 4 should return 0 items but count should still be 25)
    const query4 = database.query(Item).itemsPerPage(10).page(4);
    const [page4Items, total4] = await Promise.all([query4.find(), query4.count()]);
    expect(page4Items.length).toBe(0);
    expect(total4).toBe(25); // count should return total even when page is empty
});
