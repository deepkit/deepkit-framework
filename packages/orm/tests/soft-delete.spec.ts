import { entity, plainToClass, t } from '@deepkit/type';
import { test } from '@jest/globals';
import { getInstanceState } from '../src/identity-map';
import { Database } from '../src/database';
import { MemoryDatabaseAdapter } from '../src/memory-db';
import { SoftDelete, SoftDeleteQuery, SoftDeleteSession } from '../src/plugin/soft-delete';

test('soft-delete query', async () => {
    const s = t.schema({
        id: t.number.autoIncrement.primary,
        username: t.string,
        deletedAt: t.date.optional,
        deletedBy: t.string.optional,
    }, { name: 'User' });

    const memory = new MemoryDatabaseAdapter();
    const database = new Database(memory);
    const softDelete = new SoftDelete(database);
    softDelete.enable(s);

    await database.persist(plainToClass(s, { id: 1, username: 'Peter' }));
    await database.persist(plainToClass(s, { id: 2, username: 'Joe' }));
    await database.persist(plainToClass(s, { id: 3, username: 'Lizz' }));

    expect(await database.query(s).count()).toBe(3);

    await database.query(s).filter({ id: 1 }).deleteOne();

    expect(await database.query(s).count()).toBe(2);

    await SoftDeleteQuery.from(database.query(s)).filter({ id: 2 }).deletedBy('me').deleteOne();

    expect(await database.query(s).count()).toBe(1);
    expect(await SoftDeleteQuery.from(database.query(s)).withSoftDeleted().count()).toBe(3);
    const deleted2 = await SoftDeleteQuery.from(database.query(s)).withSoftDeleted().filter({ id: 2 }).findOne();
    expect(deleted2.id).toBe(2);
    expect(deleted2.deletedAt).not.toBe(undefined);
    expect(deleted2.deletedBy).toBe('me');

    await SoftDeleteQuery.from(database.query(s).filter({ id: 1 })).restoreOne();

    expect(await database.query(s).count()).toBe(2);
    expect(await SoftDeleteQuery.from(database.query(s)).withSoftDeleted().count()).toBe(3);

    await SoftDeleteQuery.from(database.query(s)).restoreMany();
    expect(await database.query(s).count()).toBe(3);
    expect(await SoftDeleteQuery.from(database.query(s)).withSoftDeleted().count()).toBe(3);

    //soft delete everything
    await database.query(s).deleteMany();
    expect(await database.query(s).count()).toBe(0);
    expect(await SoftDeleteQuery.from(database.query(s)).withSoftDeleted().count()).toBe(3);

    //hard delete everything
    await SoftDeleteQuery.from(database.query(s)).hardDeleteMany();
    expect(await database.query(s).count()).toBe(0);
    expect(await SoftDeleteQuery.from(database.query(s)).withSoftDeleted().count()).toBe(0);
});

test('soft-delete session', async () => {
    @entity.name('softDeleteUser')
    class User {
        @t.primary.autoIncrement id: number = 0;
        @t.optional deletedAt?: Date;
        @t.optional deletedBy?: string;

        constructor(
            @t public username: string,
        ) { }
    }

    const memory = new MemoryDatabaseAdapter();
    const database = new Database(memory);
    const softDelete = new SoftDelete(database);
    softDelete.enable(User);

    const session = database.createSession();
    const peter = new User('peter');
    const joe = new User('Joe');
    const lizz = new User('Lizz');
    session.add(peter, joe, lizz);
    await session.commit();
    expect(getInstanceState(peter).isKnownInDatabase()).toBe(true);

    expect(await database.query(User).count()).toBe(3);

    {
        const peterDB = await session.query(User).filter({ id: 1 }).findOne();
        session.remove(peterDB);
        await session.commit();
        expect(getInstanceState(peterDB).isKnownInDatabase()).toBe(true);

        expect(await database.query(User).count()).toBe(2);
        expect(await SoftDeleteQuery.from(session.query(User)).withSoftDeleted().count()).toBe(3);

        session.from(SoftDeleteSession).restore(peterDB);
        await session.commit();
        expect(await database.query(User).count()).toBe(3);
        {
            const deletedPeter = await session.query(User).filter(peterDB).findOne();
            expect(deletedPeter.deletedAt).toBe(undefined);
            expect(deletedPeter.deletedBy).toBe(undefined);
        }

        session.from(SoftDeleteSession).setDeletedBy(User, 'me');
        session.remove(peterDB);
        await session.commit();
        expect(await database.query(User).count()).toBe(2);
        const deletedPeter = await SoftDeleteQuery.from(session.query(User)).withSoftDeleted().filter(peterDB).findOne();
        expect(deletedPeter.deletedAt).toBeInstanceOf(Date);
        expect(deletedPeter.deletedBy).toBe('me');

        session.from(SoftDeleteSession).restore(peterDB);
        await session.commit();
    }
});
