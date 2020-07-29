import 'jest';
import 'jest-extended';
import 'reflect-metadata';
import {Database} from "@super-hornet/marshal-orm";
import {MongoDatabaseAdapter, MongoDatabaseConfig} from "../src/adapter";
import {Entity, t} from "@super-hornet/marshal";

jest.setTimeout(100000);

test('simple', async () => {
    @Entity('asd')
    class Test {
        @t.primary.mongoId
        _id!: string;

        constructor(@t public name: string) {
        }
    }

    const config = new MongoDatabaseConfig('localhost', 'test');
    const database = new Database(new MongoDatabaseAdapter(config));

    await database.query(Test).deleteMany();

    {
        const item = new Test('asd');
        await database.createSession().immediate.persist(item);
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
    @Entity('asd2')
    class Test {
        @t.primary.mongoId
        _id!: string;

        constructor(@t public name: string) {
        }
    }

    const config = new MongoDatabaseConfig('localhost', 'test');
    const database = new Database(new MongoDatabaseAdapter(config));
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

    session.immediate.remove(item);
    await session.commit();
    expect(await session.query(Test).filter({name: 'asd'}).has()).toBe(false);
    database.disconnect();
});

test('repository', async () => {
    @Entity('asd3')
    class Test {
        @t.primary.mongoId
        _id!: string;

        constructor(@t public name: string) {
        }
    }

    const config = new MongoDatabaseConfig('localhost', 'test');
    const database = new Database(new MongoDatabaseAdapter(config));
    await database.query(Test).deleteMany();
    const item = new Test('asda');
    await database.createSession().immediate.persist(item);

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
    @Entity('asd4')
    class Test {
        @t.primary.mongoId
        _id!: string;

        constructor(@t public name: string) {
        }
    }

    const config = new MongoDatabaseConfig('localhost', 'test');
    const database = new Database(new MongoDatabaseAdapter(config));
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
