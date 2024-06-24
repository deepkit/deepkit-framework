import {
    includeSoftDeleted,
    restoreMany,
    restoreOne,
    setDeletedBy,
    SoftDeletePlugin,
    SoftDeleteSession,
} from '@deepkit/orm';
import { AutoIncrement, cast, entity, PrimaryKey } from '@deepkit/type';
import { DatabaseFactory } from './test.js';
import { expect } from '@jest/globals';

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

        expect(await database.singleQuery(s).count()).toBe(3);

        await database.singleQuery(s).filter({ id: 1 }).deleteOne();
        expect(await database.singleQuery(s).count()).toBe(2);

        //soft delete using deletedBy
        await database.singleQuery(s, m => {
            setDeletedBy('me');
        }).filter({ id: 2 }).deleteOne();
        expect(await database.singleQuery(s).count()).toBe(1);
        {
            const deleted2 = await database.singleQuery(s, m => includeSoftDeleted()).filter({ id: 2 }).findOne();
            expect(deleted2.id).toBe(2);
            expect(deleted2.deletedAt).not.toBe(undefined);
            expect(deleted2.deletedBy).toBe('me');
        }

        //restore first
        await restoreOne(database.singleQuery(s).filter({ id: 1 }));
        expect(await database.singleQuery(s).count()).toBe(2);

        //restore all
        await restoreMany(database.singleQuery(s));
        expect(await database.singleQuery(s).count()).toBe(3);
        {
            const deleted2 = await database.singleQuery(s).filter({ id: 2 }).findOne();
            expect(deleted2.deletedBy).toBe(undefined);
        }

        //soft delete everything
        await database.singleQuery(s).deleteMany();
        expect(await database.singleQuery(s).count()).toBe(0);
        expect(await database.singleQuery(s, m => includeSoftDeleted()).count()).toBe(3);

        //hard delete everything
        await database.singleQuery(s, m => includeSoftDeleted()).deleteMany();
        expect(await database.singleQuery(s).count()).toBe(0);
        expect(await database.singleQuery(s, m => includeSoftDeleted()).count()).toBe(0);

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

        expect(await database.singleQuery(User).count()).toBe(3);

        {
            const peter = await session.query(User).filter({ id: 1 }).findOne();
            session.remove(peter);
            await session.commit();
            expect(await database.singleQuery(User).count()).toBe(2);
            expect(await database.singleQuery(User, m => includeSoftDeleted()).count()).toBe(3);

            session.from(SoftDeleteSession).restore(peter);
            await session.commit();
            expect(await database.singleQuery(User).count()).toBe(3);
            {
                const deletedPeter = await session.query(User).filter(peter).findOne();
                expect(deletedPeter.deletedAt).toBe(undefined);
                expect(deletedPeter.deletedBy).toBe(undefined);
            }

            session.from(SoftDeleteSession).setDeletedBy(User, 'me');
            session.remove(peter);
            await session.commit();
            expect(await database.singleQuery(User).count()).toBe(2);
            const deletedPeter = await session.query(User, m => includeSoftDeleted()).filter(peter).findOne();
            expect(deletedPeter.deletedAt).toBeInstanceOf(Date);
            expect(deletedPeter.deletedBy).toBe('me');

            session.from(SoftDeleteSession).restore(peter);
            await session.commit();
        }

        database.disconnect();
    },
};
