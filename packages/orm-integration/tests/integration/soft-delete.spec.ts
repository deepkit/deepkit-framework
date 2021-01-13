import 'reflect-metadata';
import { SoftDelete, SoftDeleteQuery, SoftDeleteSession } from '@deepkit/orm';
import { entity, getClassSchema, plainToClass, t } from '@deepkit/type';
import { test } from '@jest/globals';
import { createEnvSetup } from './setup';

test('soft-delete query', async () => {
    const s = t.schema({
        id: t.number.autoIncrement.primary,
        username: t.string,
        deletedAt: t.date.optional,
        deletedBy: t.string.optional,
    }, { name: 'softDeleteUser' });

    const database = await createEnvSetup([s]);
    const softDelete = new SoftDelete(database);
    softDelete.enable(s);

    await database.persist(plainToClass(s, { id: 1, username: 'Peter' }));
    await database.persist(plainToClass(s, { id: 2, username: 'Joe' }));
    await database.persist(plainToClass(s, { id: 3, username: 'Lizz' }));

    expect(await database.query(s).count()).toBe(3);

    await database.query(s).filter({ id: 1 }).deleteOne();
    expect(await database.query(s).count()).toBe(2);

    //soft delete using deletedBy
    await database.query(s).lift(SoftDeleteQuery).filter({ id: 2 }).deletedBy('me').deleteOne();
    expect(await database.query(s).count()).toBe(1);
    {
        const deleted2 = await database.query(s).lift(SoftDeleteQuery).withSoftDeleted().filter({ id: 2 }).findOne();
        expect(deleted2.id).toBe(2);
        expect(deleted2.deletedAt).not.toBe(undefined);
        expect(deleted2.deletedBy).toBe('me');
    }

    //restore first
    await database.query(s).filter({ id: 1 }).lift(SoftDeleteQuery).restoreOne();
    expect(await database.query(s).count()).toBe(2);

    //restore all
    await database.query(s).lift(SoftDeleteQuery).restoreMany();
    expect(await database.query(s).count()).toBe(3);
    {
        const deleted2 = await database.query(s).filter({ id: 2 }).findOne();
        expect(deleted2.deletedBy).toBe(undefined);
    }

    //soft delete everything
    await database.query(s).deleteMany();
    expect(await database.query(s).count()).toBe(0);
    expect(await database.query(s).lift(SoftDeleteQuery).withSoftDeleted().count()).toBe(3);

    //hard delete everything
    await database.query(s).lift(SoftDeleteQuery).withSoftDeleted().deleteMany();
    expect(await database.query(s).count()).toBe(0);
    expect(await database.query(s).lift(SoftDeleteQuery).withSoftDeleted().count()).toBe(0);
});

test('soft-delete session', async () => {
    @entity.name('softDeleteUser2')
    class User {
        @t.primary.autoIncrement id: number = 0;
        @t deletedAt?: Date;
        @t deletedBy?: string;

        constructor(
            @t public username: string,
        ) { }
    }

    expect(getClassSchema(User).getProperty('id').type).toBe('number');
    const database = await createEnvSetup([User]);
    const softDelete = new SoftDelete(database);
    softDelete.enable(User);

    const session = database.createSession();
    const peter = new User('peter');
    const joe = new User('Joe');
    const lizz = new User('Lizz');
    session.add(peter, joe, lizz);
    await session.commit();

    expect(await database.query(User).count()).toBe(3);

    {
        const peter = await session.query(User).filter({ id: 1 }).findOne();
        session.remove(peter);
        await session.commit();
        expect(await database.query(User).count()).toBe(2);
        expect(await SoftDeleteQuery.from(session.query(User)).withSoftDeleted().count()).toBe(3);

        session.from(SoftDeleteSession).restore(peter);
        await session.commit();
        expect(await database.query(User).count()).toBe(3);
        {
            const deletedPeter = await session.query(User).filter(peter).findOne();
            expect(deletedPeter.deletedAt).toBe(undefined);
            expect(deletedPeter.deletedBy).toBe(undefined);
        }

        session.from(SoftDeleteSession).setDeletedBy(User, 'me');
        session.remove(peter);
        await session.commit();
        expect(await database.query(User).count()).toBe(2);
        const deletedPeter = await SoftDeleteQuery.from(session.query(User)).withSoftDeleted().filter(peter).findOne();
        expect(deletedPeter.deletedAt).toBeInstanceOf(Date);
        expect(deletedPeter.deletedBy).toBe('me');

        session.from(SoftDeleteSession).restore(peter);
        await session.commit();
    }
});
