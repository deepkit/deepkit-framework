import { expect, test } from '@jest/globals';
import { createPool } from 'mariadb';
import { MySQLConnectionPool } from '../src/mysql-adapter.js';
import { AutoIncrement, cast, entity, PrimaryKey } from '@deepkit/type';
import { databaseFactory } from './factory.js';

test('connection MySQLConnectionPool', async () => {
    const pool = createPool({
        host: '127.0.0.1',
        user: 'root',
        database: 'default',
    });
    const connectionPool = new MySQLConnectionPool(pool);

    for (let i = 0; i < 50; i++) {
        const connection = await connectionPool.getConnection();
        const stmt = await connection.prepare('SELECT 1');
        await stmt.all();
        stmt.release();
        connection.release();
    }

    expect(connectionPool.getActiveConnections()).toBe(0);
    await pool.end();
});

test('connection release persistence/query', async () => {
    @entity.name('test_connection_user')
    class user {
        id: number & PrimaryKey & AutoIncrement = 0;
        username: string = '';
    }

    const database = await databaseFactory([user]);
    const adapter = database.adapter;
    const session = database.createSession();

    session.add(cast<user>({ username: '123' }));
    await session.commit();
    expect((adapter as any).pool.activeConnections()).toBe(0);
    expect(adapter.connectionPool.getActiveConnections()).toBe(0);

    const myUser = await database.query(user).filter({ username: '123' }).findOne();
    expect(myUser.username).toBe('123');
    expect((adapter as any).pool.activeConnections()).toBe(0);
    expect(adapter.connectionPool.getActiveConnections()).toBe(0);

    await database.persist(cast<user>({ username: '444' }));
    const myUser2 = await database.query(user).filter({ username: '444' }).findOne();
    expect(myUser2.username).toBe('444');
    expect((adapter as any).pool.activeConnections()).toBe(0);
    expect(adapter.connectionPool.getActiveConnections()).toBe(0);

    await database.remove(myUser2);
    expect(await database.query(user).count()).toBe(1);
    expect((adapter as any).pool.activeConnections()).toBe(0);
    expect(adapter.connectionPool.getActiveConnections()).toBe(0);

    database.disconnect();
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
        const m = new Model;
        m.flag = true;
        m.doc.flag = true;
        await database.persist(m);
    }

    const m = await database.query(Model).findOne();
    expect(m).toMatchObject({ flag: true, doc: { flag: true } });
    database.disconnect();
});

test('change different fields of multiple entities', async () => {
    @entity.name('model2')
    class Model {
        firstName: string = '';
        lastName: string = '';

        constructor(public id: number & PrimaryKey) {
        }
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
    database.disconnect();
});

test('change pk', async () => {
    @entity.name('model3')
    class Model {
        firstName: string = '';

        constructor(public id: number & PrimaryKey) {
        }
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
    database.disconnect();
});

test('for update/share', async () => {
    @entity.name('model4')
    class Model {
        firstName: string = '';

        constructor(public id: number & PrimaryKey) {
        }
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

test('union', async () => {
    @entity.name('union1_service')
    class Service {
        restartPolicy: 'always' | 'on-failure' | 'no' = 'always';
        ids: 23 | 42 = 23;
        complexUnion: { foo: string } | 54 = 54;
        doc: { name: string } | null = null;

        constructor(public id: number & PrimaryKey) {
        }
    }

    const database = await databaseFactory([Service]);

    {
        const service = new Service(1);
        service.restartPolicy = 'no';
        service.ids = 42;
        await database.persist(service);
    }
    {
        const service = new Service(2);
        service.complexUnion = { foo: 'bar' };
        service.doc = { name: 'peter' };
        await database.persist(service);
    }

    {
        const service = await database.query(Service).filter({ id: 1 }).findOne();
        expect(service.restartPolicy).toBe('no');
        expect(service.ids).toBe(42);
        expect(service.complexUnion).toBe(54);
    }

    {
        const service = await database.query(Service).filter({ id: 2 }).findOne();
        expect(service.restartPolicy).toBe('always');
        expect(service.ids).toBe(23);
        expect(service.complexUnion).toEqual({ foo: 'bar' });

        service.complexUnion = 54;
        service.ids = 42;
        service.restartPolicy = 'no';
        service.doc = null;
        await database.persist(service);

        const service2 = await database.query(Service).filter({ id: 2 }).findOne();
        expect(service2.restartPolicy).toBe('no');
        expect(service2.ids).toBe(42);
        expect(service2.complexUnion).toBe(54);
        expect(service2.doc).toBe(null);
    }

    {
        await database.query(Service)
            .filter({id: 2})
            .patchOne({
                restartPolicy: 'no',
                ids: 42,
                complexUnion: 54,
                doc: null,
            });
    }
})
