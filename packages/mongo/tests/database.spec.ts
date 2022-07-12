import { expect, test } from '@jest/globals';
import { Database } from '@deepkit/orm';
import { MongoDatabaseAdapter } from '../src/adapter.js';
import { entity, MongoId, PrimaryKey } from '@deepkit/type';

test('simple', async () => {
    @entity.name('asd')
    class Test {
        _id: MongoId & PrimaryKey = '';

        constructor(public name: string) {
        }
    }

    const database = new Database(new MongoDatabaseAdapter('mongodb://localhost/test'));
    await database.query(Test).deleteMany();

    {
        const item = new Test('asd');
        await database.persist(item);
    }

    {
        expect(await database.query(Test).filter({name: {$regex: /asd/}}).has()).toBe(true);
        const item = await database.query(Test).filter({name: 'asd'}).findOne();
        expect(item).toBeInstanceOf(Test);
        expect(item.name).toBe('asd');
    }
    database.disconnect();
});

test('unit of work', async () => {
    @entity.name('asd2')
    class Test {
        _id: MongoId & PrimaryKey = '';

        constructor(public name: string) {
        }
    }

    const database = new Database(new MongoDatabaseAdapter('mongodb://localhost/test'));
    await database.query(Test).deleteMany();

    const session = database.createSession();

    const item = new Test('asd');
    session.add(item);
    await session.commit();

    {
        expect(await session.query(Test).filter({name: 'asd'}).has()).toBe(true);
        const item = await session.query(Test).filter({name: 'asd'}).findOne();
        expect(item).toBeInstanceOf(Test);
        expect(item.name).toBe('asd');
    }

    await session.remove(item);
    await session.commit();
    expect(await session.query(Test).filter({name: 'asd'}).has()).toBe(false);
    database.disconnect();
});

test('repository', async () => {
    @entity.name('asd3')
    class Test {
        _id: MongoId & PrimaryKey = '';

        constructor(public name: string) {
        }
    }

    const database = new Database(new MongoDatabaseAdapter('mongodb://localhost/test'));
    await database.query(Test).deleteMany();
    const item = new Test('asda');
    await database.persist(item);

    class TestRepository {
        constructor(protected database: Database<MongoDatabaseAdapter>) {
        }

        async findById(id: string) {
            return this.database.query(Test).filter({_id: id}).findOne();
        }
    }

    const repo = new TestRepository(database);
    const itemFromRepo = await repo.findById(item._id);
    expect(itemFromRepo).toBeInstanceOf(Test);
    expect(itemFromRepo._id).toBe(item._id);

    database.disconnect();
});

test('session', async () => {
    @entity.name('asd4')
    class Test {
        _id: MongoId & PrimaryKey = '';

        constructor(public name: string) {
        }
    }

    const database = new Database(new MongoDatabaseAdapter('mongodb://localhost/test'));
    await database.query(Test).deleteMany();

    await database.session(async (session) => {
        const item = new Test('asd');
        session.add(item);
    });

    {
        expect(await database.query(Test).filter({name: 'asd'}).has()).toBe(true);
        const item = await database.query(Test).filter({name: 'asd'}).findOne();
        expect(item).toBeInstanceOf(Test);
        expect(item.name).toBe('asd');
    }

    database.disconnect();
});
