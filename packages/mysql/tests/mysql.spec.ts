import 'reflect-metadata';
import { plainToClass, t } from '@deepkit/type';
import { createPool } from 'mariadb';
import { MySQLConnectionPool, MySQLDatabaseAdapter } from '../src/mysql-adapter';
import { Database } from '@deepkit/orm';

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
    const user = t.schema({
        id: t.number.primary.autoIncrement,
        username: t.string
    }, { name: 'test_connection_user' });

    const adapter = new MySQLDatabaseAdapter({ host: 'localhost', user: 'root', database: 'default', password: process.env.MYSQL_PW });
    const database = new Database(adapter);
    database.registerEntity(user);
    await adapter.createTables([...database.entities]);
    const session = database.createSession();

    session.add(plainToClass(user, { id: undefined, username: '123' }));
    await session.commit();
    expect((adapter as any).pool.activeConnections()).toBe(0);
    expect(adapter.connectionPool.getActiveConnections()).toBe(0);

    const myUser = await database.query(user).filter({ username: '123' }).findOne();
    expect(myUser.username).toBe('123');
    expect((adapter as any).pool.activeConnections()).toBe(0);
    expect(adapter.connectionPool.getActiveConnections()).toBe(0);

    await database.persist(plainToClass(user, { id: undefined, username: '444' }));
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
