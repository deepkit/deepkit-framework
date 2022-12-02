import { Database } from '@deepkit/orm';
import { AutoIncrement } from '@deepkit/type';
import { entity, PrimaryKey } from '@deepkit/type';
import { expect, test } from '@jest/globals';
import pg from 'pg';
import { PostgresDatabaseAdapter } from '../src/postgres-adapter';

test('count', async () => {
    const pool = new pg.Pool({
        host: 'localhost',
        database: 'postgres',
        user: 'postgres',
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

    const adapter = new PostgresDatabaseAdapter({ host: '127.0.0.1', database: 'postgres', user: 'postgres' });
    const database = new Database(adapter, [Model]);
    await adapter.createTables(database.entityRegistry);

    {
        const m = new Model;
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
        constructor(public id: number & PrimaryKey) {
        }
    }

    const adapter = new PostgresDatabaseAdapter({ host: '127.0.0.1', database: 'postgres', user: 'postgres' });
    const database = new Database(adapter, [Model]);
    await adapter.createTables(database.entityRegistry);

    {
        const m1 = new Model(1);
        m1.firstName = 'Peter';
        await database.persist(m1);
        const m2 = new Model(2);
        m2.lastName = 'Smith';
        await database.persist(m2);
    }

    {
        const m1 = await database.query(Model).filter({id: 1}).findOne();
        const m2 = await database.query(Model).filter({id: 2}).findOne();

        m1.firstName = 'Peter2';
        m2.lastName = 'Smith2';
        await database.persist(m1, m2);
    }

    {
        const m1 = await database.query(Model).filter({id: 1}).findOne();
        const m2 = await database.query(Model).filter({id: 2}).findOne();

        expect(m1).toMatchObject({id: 1, firstName: 'Peter2', lastName: ''});
        expect(m2).toMatchObject({id: 2, firstName: '', lastName: 'Smith2'});
    }
});

test('change pk', async () => {
    @entity.name('model3')
    class Model {
        firstName: string = '';
        constructor(public id: number & PrimaryKey) {
        }
    }

    const adapter = new PostgresDatabaseAdapter({ host: '127.0.0.1', database: 'postgres', user: 'postgres' });
    const database = new Database(adapter, [Model]);
    await adapter.createTables(database.entityRegistry);

    {
        const m1 = new Model(1);
        m1.firstName = 'Peter';
        await database.persist(m1);
    }

    {
        const m1 = await database.query(Model).filter({id: 1}).findOne();
        m1.id = 2;
        await database.persist(m1);
    }

    {
        const m1 = await database.query(Model).filter({id: 2}).findOne();
        expect(m1).toMatchObject({id: 2, firstName: 'Peter'});
    }

    {
        const m1 = await database.query(Model).filter({id: 2}).findOne();
        m1.id = 3;
        m1.firstName = 'Peter2';
        await database.persist(m1);
    }

    {
        const m1 = await database.query(Model).filter({id: 3}).findOne();
        expect(m1).toMatchObject({id: 3, firstName: 'Peter2'});
    }
});
