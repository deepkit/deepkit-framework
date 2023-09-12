import { SoftDeletePlugin, SoftDeleteQuery, SoftDeleteSession } from '@deepkit/orm';
import { AutoIncrement, cast, entity, PrimaryKey } from '@deepkit/type';
import { DatabaseFactory } from './test.js';

export const softDeletePluginTests = {
    async query(databaseFactory: DatabaseFactory) {
        @entity.name('softDeleteUser')
        class s {
            id!: number & AutoIncrement & PrimaryKey;
            username!: string;
            deletedAt?: Date;
            deletedBy?: string;
        }

        const database = await databaseFactory([s]);
        database.registerPlugin(new SoftDeletePlugin);

        await database.persist(cast<s>({ id: 1, username: 'Peter' }));
        await database.persist(cast<s>({ id: 2, username: 'Joe' }));
        await database.persist(cast<s>({ id: 3, username: 'Lizz' }));

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

        database.disconnect();
    },

    async session(databaseFactory: DatabaseFactory) {
        @entity.name('softDeleteUser2')
        class User {
            id: number & AutoIncrement & PrimaryKey = 0;
            deletedAt?: Date;
            deletedBy?: string;

            constructor(
                public username: string,
            ) {
            }
        }

        const database = await databaseFactory([User]);
        database.registerPlugin(new SoftDeletePlugin);

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

        database.disconnect();
    },
};
