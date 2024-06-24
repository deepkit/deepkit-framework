import { AutoIncrement, deserialize, entity, PrimaryKey } from '@deepkit/type';
import { expect, test } from '@jest/globals';
import { getInstanceStateFromItem } from '../src/identity-map.js';
import { Database } from '../src/database.js';
import { MemoryDatabaseAdapter } from '../src/memory-db.js';
import { includeOnlySoftDeleted, includeSoftDeleted, restoreMany, restoreOne, setDeletedBy, SoftDeletePlugin, SoftDeleteSession } from '../src/plugin/soft-delete-plugin.js';

test('soft-delete query', async () => {
    class User {
        id!: number & PrimaryKey & AutoIncrement;

        constructor(public username: string) {
        }

        deletedAt?: Date;
        deletedBy?: string;
    }

    const memory = new MemoryDatabaseAdapter();
    const database = new Database(memory, [User]);
    database.registerPlugin(new SoftDeletePlugin);
    database.logger.enableLogging();

    await database.persist(deserialize<User>({ id: 1, username: 'Peter' }));
    await database.persist(deserialize<User>({ id: 2, username: 'Joe' }));
    await database.persist(deserialize<User>({ id: 3, username: 'Lizz' }));

    expect(await database.singleQuery(User).count()).toBe(3);

    await database.singleQuery(User).filter({ id: 1 }).deleteOne();

    expect(await database.singleQuery(User).count()).toBe(2);
    expect(await database.singleQuery(User, user => {
        includeOnlySoftDeleted(user);
    }).count()).toBe(1);

    await database.singleQuery(User, user => {
        setDeletedBy('me');
    }).filter({ id: 2 }).deleteOne();

    expect(await database.singleQuery(User).count()).toBe(1);
    expect(await database.singleQuery(User, user => {
        includeSoftDeleted();
    }).count()).toBe(3);
    const deleted2 = await database.singleQuery(User, user => {
        includeSoftDeleted();
    }).filter({ id: 2 }).findOne();
    expect(deleted2.id).toBe(2);
    expect(deleted2.deletedAt).not.toBe(undefined);
    expect(deleted2.deletedBy).toBe('me');

    // how to restore?
    await restoreOne(database.singleQuery(User).filter({ id: 1 }));

    expect(await database.singleQuery(User).count()).toBe(2);
    expect(await database.singleQuery(User, user=> includeSoftDeleted()).count()).toBe(3);

    await restoreMany(database.singleQuery(User));
    expect(await database.singleQuery(User).count()).toBe(3);
    expect(await database.singleQuery(User, user=> includeSoftDeleted()).count()).toBe(3);

    //soft delete everything
    await database.singleQuery(User).deleteMany();
    expect(await database.singleQuery(User).count()).toBe(0);
    expect(await database.singleQuery(User, user=> includeSoftDeleted()).count()).toBe(3);

    //hard delete everything
    await database.singleQuery(User, user => {
        includeSoftDeleted();
    }).deleteMany();
    expect(await database.singleQuery(User).count()).toBe(0);
    expect(await database.singleQuery(User, user=> includeSoftDeleted()).count()).toBe(0);
});

test('soft-delete session', async () => {
    @entity.name('softDeleteUser')
    class User {
        id: number & PrimaryKey & AutoIncrement = 0;
        deletedAt?: Date;
        deletedBy?: string;

        constructor(
            public username: string,
        ) {
        }
    }

    const memory = new MemoryDatabaseAdapter();
    const database = new Database(memory, [User]);
    database.registerPlugin(new SoftDeletePlugin);
    database.logger.enableLogging();

    const session = database.createSession();
    const peter = new User('peter');
    const joe = new User('Joe');
    const lizz = new User('Lizz');
    session.add(peter, joe, lizz);
    await session.commit();
    expect(getInstanceStateFromItem(peter).isKnownInDatabase()).toBe(true);

    expect(await database.singleQuery(User).count()).toBe(3);

    {
        const peterDB: User = (await session.singleQuery(User).filter({ id: 1 }).find())[0];
        expect(getInstanceStateFromItem(peterDB).isKnownInDatabase()).toBe(true);
        expect(getInstanceStateFromItem(peterDB).isFromDatabase()).toBe(true);
        session.remove(peterDB);
        await session.commit();
        expect(getInstanceStateFromItem(peterDB).isKnownInDatabase()).toBe(true);

        expect(await database.singleQuery(User).count()).toBe(2);
        expect(await session.singleQuery(User, user => {
            includeSoftDeleted();
        }).count()).toBe(3);

        session.from(SoftDeleteSession).restore(peterDB);
        await session.commit();
        expect(await database.singleQuery(User).count()).toBe(3);
        {
            const deletedPeter = await session.singleQuery(User).filter(peterDB).findOne();
            expect(deletedPeter.deletedAt).toBe(undefined);
            expect(deletedPeter.deletedBy).toBe(undefined);
        }

        session.from(SoftDeleteSession).setDeletedBy(User, 'me');
        session.remove(peterDB);
        await session.commit();
        expect(await database.singleQuery(User).count()).toBe(2);
        const deletedPeter = await session.singleQuery(User, user => {
            includeSoftDeleted();
        }).filter(peterDB).findOne();
        expect(deletedPeter.deletedAt).toBeInstanceOf(Date);
        expect(deletedPeter.deletedBy).toBe('me');

        session.from(SoftDeleteSession).restore(peterDB);
        await session.commit();
    }
});
