import { expect } from '@jest/globals';
import { AutoIncrement, cast, entity, isReferenceInstance, PrimaryKey, Reference, Unique } from '@deepkit/type';
import { identifier, sql, SQLDatabaseAdapter } from '@deepkit/sql';
import { DatabaseFactory } from './test';
import { isDatabaseOf, UniqueConstraintFailure } from '@deepkit/orm';
import { randomBytes } from 'crypto';

Error.stackTraceLimit = 20;

export const variousTests = {
    async testRawQuery(databaseFactory: DatabaseFactory) {
        @entity.name('test_connection_user')
        class user {
            id: number & PrimaryKey & AutoIncrement = 0;
            username!: string;
        }

        const database = await databaseFactory([user]);

        if (!isDatabaseOf(database, SQLDatabaseAdapter)) return;

        await database.persist(cast<user>({ username: 'peter' }));
        await database.persist(cast<user>({ username: 'marie' }));

        {
            const result = await database.raw(sql`SELECT count(*) as count
                                                  FROM ${user}`).findOne();
            expect(result.count).toBe(2);
        }

        {
            const result = await database.createSession().raw(sql`SELECT count(*) as count
                                                                  FROM ${user}`).findOne();
            expect(result.count).toBe(2);
        }

        {
            const id = 1;
            const result = await database.createSession().raw(sql`SELECT count(*) as count
                                                                  FROM ${user}
                                                                  WHERE id > ${id}`).findOne();
            expect(result.count).toBe(1);
        }

        {
            const result = await database.raw(sql`SELECT *
                                                  FROM ${user}`).find();
            expect(result).toEqual([
                { id: 1, username: 'peter' },
                { id: 2, username: 'marie' },
            ]);
        }

        {
            const result = await database.createSession().raw(sql`SELECT *
                                                                  FROM ${user}`).find();
            expect(result).toEqual([
                { id: 1, username: 'peter' },
                { id: 2, username: 'marie' },
            ]);
        }

        await database.raw(sql`DELETE
                               FROM ${user}`).execute();

        {
            const result = await database.raw(sql`SELECT count(*) as count
                                                  FROM ${user}`).findOne();
            expect(result.count).toBe(0);
        }
        database.disconnect();
    },
    async testRawWhere(databaseFactory: DatabaseFactory) {
        @entity.name('test_connection_user')
        class user {
            id: number & PrimaryKey & AutoIncrement = 0;
            username!: string;
        }

        const database = await databaseFactory([user]);
        if (!isDatabaseOf(database, SQLDatabaseAdapter)) return;

        if (isDatabaseOf(database, SQLDatabaseAdapter)) {
            await database.persist(cast<user>({ username: 'peter' }), cast<user>({ username: 'marie' }), cast<user>({ username: 'mueller' }));

            {
                const result = await database.query(user).where(sql`id > 1`).findOne();
                expect(result).toMatchObject({ id: 2, username: 'marie' });
            }

            {
                const id = 1;
                const result = await database.query(user).where(sql`id = ${id}`).findOne();
                expect(result).toMatchObject({ id: 1, username: 'peter' });
            }

            {
                const id = 3;
                const result = await database.query(user).filter({ id: { $gt: 1 } })
                    .where(sql`${identifier('id')} < ${id}`).find();
                expect(result).toMatchObject([{ id: 2, username: 'marie' }]);
            }

            {
                const result = await database.query(user).withSum('id', 'countUsers').withMax('id', 'maxId').withMin('id').findOne();
                expect(result.countUsers).toBe(1 + 2 + 3);
                expect(result.maxId).toBe(3);
                expect(result.id).toBe(1);
            }

            {
                const result = await database.query(user).sqlSelect(sql`count(*) as count`).findOne();
                expect(result.count).toBe(3);
            }
        }
        database.disconnect();
    },
    async testSelfReference(databaseFactory: DatabaseFactory) {
        @entity.name('explorer/block').collection('blocks')
        class ExplorerBlock {
            public id: number & PrimaryKey & AutoIncrement = 0;

            level: number = 0;
            transactions: number = 0;

            constructor(
                public hash: Uint8Array,
                public created: Date,
                public previous?: ExplorerBlock & Reference
            ) {
            }
        }

        const database = await databaseFactory([ExplorerBlock]);
        const session = database.createSession();

        let previous: ExplorerBlock | undefined = undefined;

        for (let i = 0; i < 10; i++) {
            previous = new ExplorerBlock(randomBytes(16), new Date, previous);

            previous.level = Math.ceil(Math.random() * 1000);
            previous.transactions = Math.ceil(Math.random() * 1000);
            session.add(previous);
        }

        await session.commit();

        expect(await database.query(ExplorerBlock).count()).toBe(10);

        const blocks = await database.query(ExplorerBlock).sort({ id: 'desc' }).find();

        for (const block of blocks) {
            expect(isReferenceInstance(block)).toBe(false);
            if (block.previous) {
                expect(block.previous).toBeInstanceOf(ExplorerBlock);
                expect(isReferenceInstance(block.previous)).toBe(true);
            }
            expect(block.level).toBeGreaterThan(0);
        }
        database.disconnect();
    },
    async transactionSimple(databaseFactory: DatabaseFactory) {
        @entity.collection('users')
        class User {
            public id: number & AutoIncrement & PrimaryKey = 0;

            constructor(public username: string) {
            }
        }

        const database = await databaseFactory([User]);

        {
            await database.query(User).deleteMany();
            await database.persist(new User('user1'));
            const session = database.createSession();
            session.useTransaction();
            const user = await session.query(User).findOne();
            expect(user.username).toBe('user1');

            expect(session.hasTransaction()).toBe(true);

            user.username = 'user1 changed';
            await session.flush(); //no transaction commit
            expect(session.hasTransaction()).toBe(true);

            expect(await session.query(User).filter({ username: 'user1 changed' }).has()).toBe(true);

            //in another connection we still have the old changed
            expect(await database.query(User).filter({ username: 'user1 changed' }).has()).toBe(false);

            await session.commit();
            expect(session.hasTransaction()).toBe(false);

            //in another connection we now have the changes
            expect(await database.query(User).filter({ username: 'user1 changed' }).has()).toBe(true);
        }

        {
            await database.query(User).deleteMany();
            await database.persist(new User('user1'));
            const session = database.createSession();
            session.useTransaction();
            const user = await session.query(User).findOne();
            expect(user.username).toBe('user1');

            user.username = 'user1 changed';
            await session.flush(); //no transaction commit

            expect(await session.query(User).filter({ username: 'user1 changed' }).has()).toBe(true);

            //in another connection we still have the old changed
            expect(await database.query(User).filter({ username: 'user1 changed' }).has()).toBe(false);

            await session.rollback();
            expect(session.hasTransaction()).toBe(false);

            //user1 changed is not there anymore
            expect(await session.query(User).filter({ username: 'user1 changed' }).has()).toBe(false);

            //in another connection still user1 is not changed.
            expect(await database.query(User).filter({ username: 'user1 changed' }).has()).toBe(false);
        }

        {
            await database.query(User).deleteMany();
            await database.createSession().transaction(async (session) => {
                session.add(new User('user 1'), new User('user 2'), new User('user 3'));
            });
            expect(await database.query(User).count()).toBe(3);
        }

        {
            await database.query(User).deleteMany();
            expect(await database.query(User).count()).toBe(0);
            await database.createSession().transaction(async (session) => {
                session.add(new User('user 1'), new User('user 2'), new User('user 3'));
                await session.flush();

                expect(await session.query(User).count()).toBe(3);

                //not yet committed
                expect(await database.query(User).count()).toBe(0);
            });
            expect(await database.query(User).count()).toBe(3);
        }

        {
            await database.query(User).deleteMany();
            expect(await database.query(User).count()).toBe(0);
            await database.transaction(async (session) => {
                session.add(new User('user 1'), new User('user 2'), new User('user 3'));
                await session.flush();

                expect(await session.query(User).count()).toBe(3);

                //not yet committed
                expect(await database.query(User).count()).toBe(0);
            });
            expect(await database.query(User).count()).toBe(3);
        }

        {
            //empty transaction
            const session = database.createSession();
            session.useTransaction();
            await session.commit();
        }

        {
            //empty transaction
            const session = database.createSession();
            session.useTransaction();
            await session.rollback();
        }

        {
            //empty transaction
            const session = database.createSession();
            await database.createSession().transaction(async (session) => {

            });
        }
        database.disconnect();
    },
    async uniqueConstraintFailure(databaseFactory: DatabaseFactory) {
        @entity.collection('usersConstraints')
        class User {
            public id: number & PrimaryKey & AutoIncrement = 0;

            constructor(public username: string & Unique) {
            }
        }

        const database = await databaseFactory([User]);

        await database.persist(new User('Peter'));

        await expect(async () => {
            await database.persist(new User('Peter'));
        }).rejects.toThrow(UniqueConstraintFailure);

        await expect(async () => {
            const session = database.createSession();
            session.add(new User('Peter'));
            await session.commit();
        }).rejects.toThrow(UniqueConstraintFailure);

        await expect(async () => {
            await database.persist(new User('Peter2'));
            await database.query(User).filter({ username: 'Peter2' }).patchOne({ username: 'Peter' });
        }).rejects.toThrow(UniqueConstraintFailure);
        database.disconnect();
    },
    async emptyEntity(databaseFactory: DatabaseFactory) {
        @entity.name('empty-entity')
        class EmptyEntity {
            id: number & PrimaryKey & AutoIncrement = 0;
        }

        const database = await databaseFactory([EmptyEntity]);

        await expect(database.persist(new EmptyEntity())).resolves.not.toThrow();
    }
};
