import 'jest';
import 'jest-extended';
import 'reflect-metadata';
import {Database} from "@super-hornet/marshal-orm";
import {MongoDatabaseAdapter, MongoDatabaseConfig} from "../src/adapter";
import {Entity, f} from "@super-hornet/marshal";

jest.setTimeout(100000);

test('simple', async () => {
    @Entity('asd')
    class Test {
        @f.primary().mongoId()
        _id!: string;

        constructor(@f public name: string) {
        }
    }

    const config = new MongoDatabaseConfig('localhost', 'test');
    const database = new Database(new MongoDatabaseAdapter(config));

    console.log('deleted', await database.query(Test).deleteMany());

    {
        const item = new Test('asd');
        await database.persist(item);
    }

    {
        const item = await database.query(Test).filter({name: 'asd'}).findOne();
        expect(item).toBeInstanceOf(Test);
        expect(item.name).toBe('asd');
    }
    database.disconnect();
});

test('unit of work', async () => {
    @Entity('asd2')
    class Test {
        @f.primary().mongoId()
        _id!: string;

        constructor(@f public name: string) {
        }
    }

    const config = new MongoDatabaseConfig('localhost', 'test');
    const database = new Database(new MongoDatabaseAdapter(config));
    console.log('deleted', await database.query(Test).deleteMany());

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

    session.remove(item);
    await session.commit();
    expect(await session.query(Test).filter({name: 'asd'}).has()).toBe(false);
    database.disconnect();
});
