import { expect, test } from '@jest/globals';
import { createPool } from 'mariadb';
import { MySQLConnectionPool, MySQLDatabaseAdapter } from '../src/mysql-adapter';
import { Database } from '@deepkit/orm';
import { AutoIncrement, cast, entity, PrimaryKey } from '@deepkit/type';

test('connection MySQLConnectionPool', async () => {
    const pool = createPool({
        host: 'localhost',
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

    const adapter = new MySQLDatabaseAdapter({ host: 'localhost', user: 'root', database: 'default', password: process.env.MYSQL_PW });
    const database = new Database(adapter, [user]);
    await adapter.createTables(database.entityRegistry);
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
    class Model {
        id: number & PrimaryKey & AutoIncrement = 0;
        flag: boolean = false;
        doc: { flag: boolean } = { flag: false };
    }

    const adapter = new MySQLDatabaseAdapter({ host: 'localhost', user: 'root', database: 'default', password: process.env.MYSQL_PW });
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
