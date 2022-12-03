import { AutoIncrement, deserialize, entity, PrimaryKey } from '@deepkit/type';
import { expect, test } from '@jest/globals';
import { Database } from '../src/database';
import { MemoryDatabaseAdapter } from '../src/memory-db';
import { LogPlugin, LogQuery, LogSession, LogType } from '../src/plugin/log-plugin.js';

test('log query', async () => {
    @entity.name('logUser1')
    class User {
        id!: number & PrimaryKey & AutoIncrement;

        constructor(public username: string) {
        }
    }

    const memory = new MemoryDatabaseAdapter();
    const database = new Database(memory, [User]);
    database.registerPlugin(new LogPlugin);

    const plugin = database.pluginRegistry.getPlugin(LogPlugin);
    const userLogEntity = plugin.getLogEntity(User);

    await database.persist(deserialize<User>({ id: 1, username: 'Peter' }));
    await database.persist(deserialize<User>({ id: 2, username: 'Joe' }));
    await database.persist(deserialize<User>({ id: 3, username: 'Lizz' }));

    {
        const logEntries = await database.query(userLogEntity).find();
        expect(logEntries).toHaveLength(3);
        expect(logEntries).toMatchObject([
            { id: 1, type: LogType.Added, reference: 1 },
            { id: 2, type: LogType.Added, reference: 2 },
            { id: 3, type: LogType.Added, reference: 3 },
        ]);
    }

    await database.query(User).filter({ id: 1 }).patchOne({ username: 'Peter2' });

    {
        const logEntries = await database.query(userLogEntity).find();
        expect(logEntries).toHaveLength(4);
        expect(logEntries).toMatchObject([
            { id: 1, type: LogType.Added, reference: 1 },
            { id: 2, type: LogType.Added, reference: 2 },
            { id: 3, type: LogType.Added, reference: 3 },
            { id: 4, type: LogType.Updated, reference: 1, changedFields: ['username'] },
        ]);
    }

    await database.query(User).patchMany({ username: '' });

    {
        const logEntries = await database.query(userLogEntity).find();
        expect(logEntries).toHaveLength(7);
        expect(logEntries).toMatchObject([
            { id: 1, type: LogType.Added, reference: 1 },
            { id: 2, type: LogType.Added, reference: 2 },
            { id: 3, type: LogType.Added, reference: 3 },
            { id: 4, type: LogType.Updated, reference: 1, changedFields: ['username'] },
            { id: 5, type: LogType.Updated, reference: 1, changedFields: ['username'] },
            { id: 6, type: LogType.Updated, reference: 2, changedFields: ['username'] },
            { id: 7, type: LogType.Updated, reference: 3, changedFields: ['username'] },
        ]);
    }

    await database.query(User).lift(LogQuery).byLogAuthor('Foo').deleteMany();

    {
        const logEntries = await database.query(userLogEntity).find();
        expect(logEntries).toHaveLength(10);
        expect(logEntries).toMatchObject([
            { id: 1, type: LogType.Added, reference: 1 },
            { id: 2, type: LogType.Added, reference: 2 },
            { id: 3, type: LogType.Added, reference: 3 },
            { id: 4, type: LogType.Updated, reference: 1, changedFields: ['username'] },
            { id: 5, type: LogType.Updated, reference: 1, changedFields: ['username'] },
            { id: 6, type: LogType.Updated, reference: 2, changedFields: ['username'] },
            { id: 7, type: LogType.Updated, reference: 3, changedFields: ['username'] },
            { id: 8, type: LogType.Deleted, reference: 1, author: 'Foo' },
            { id: 9, type: LogType.Deleted, reference: 2, author: 'Foo' },
            { id: 10, type: LogType.Deleted, reference: 3, author: 'Foo' },
        ]);
    }
});

test('log session', async () => {
    @entity.name('logUser2')
    class User {
        id: number & PrimaryKey & AutoIncrement = 0;

        constructor(public username: string) {
        }
    }

    const memory = new MemoryDatabaseAdapter();
    const database = new Database(memory, [User]);
    database.registerPlugin(new LogPlugin);

    const session = database.createSession();
    const peter = new User('peter');
    const joe = new User('Joe');
    const lizz = new User('Lizz');
    session.add(peter, joe, lizz);
    await session.commit();
    expect(await database.query(User).count()).toBe(3);

    const plugin = database.pluginRegistry.getPlugin(LogPlugin);
    const userLogEntity = plugin.getLogEntity(User);

    {
        const logEntries = await database.query(userLogEntity).find();
        expect(logEntries).toHaveLength(3);
        expect(logEntries).toMatchObject([
            { id: 1, type: LogType.Added, reference: 1 },
            { id: 2, type: LogType.Added, reference: 2 },
            { id: 3, type: LogType.Added, reference: 3 },
        ]);
    }

    {
        const peter = await database.query(User).filter({ id: 1 }).findOne();
        peter.username = 'Peter2';
        await database.persist(peter);

        const logEntries = await database.query(userLogEntity).find();
        expect(logEntries).toHaveLength(4);
        expect(logEntries).toMatchObject([
            { id: 1, type: LogType.Added, reference: 1 },
            { id: 2, type: LogType.Added, reference: 2 },
            { id: 3, type: LogType.Added, reference: 3 },
            { id: 4, type: LogType.Updated, reference: 1, changedFields: ['username'] },
        ]);
    }

    {
        const peter = await database.query(User).filter({ id: 1 }).findOne();
        const session = database.createSession();
        session.remove(peter);
        session.from(LogSession).setAuthor('Foo');
        await session.commit();

        const logEntries = await database.query(userLogEntity).find();
        expect(logEntries).toHaveLength(5);
        expect(logEntries).toMatchObject([
            { id: 1, type: LogType.Added, reference: 1 },
            { id: 2, type: LogType.Added, reference: 2 },
            { id: 3, type: LogType.Added, reference: 3 },
            { id: 4, type: LogType.Updated, reference: 1, changedFields: ['username'] },
            { id: 5, type: LogType.Deleted, reference: 1, author: 'Foo' },
        ]);
    }
});
