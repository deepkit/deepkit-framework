import { expect } from '@jest/globals';
import { entity, isReference, plainToClass, t } from '@deepkit/type';
import { identifier, sql, SQLDatabaseAdapter } from '@deepkit/sql';
import { DatabaseFactory } from './test';
import { isDatabaseOf } from '@deepkit/orm';
import { randomBytes } from 'crypto';

export const variousTests = {
    async testRawQuery(databaseFactory: DatabaseFactory) {
        const user = t.schema({
            id: t.number.primary.autoIncrement,
            username: t.string
        }, { name: 'test_connection_user' });

        const database = await databaseFactory([user]);

        if (!isDatabaseOf(database, SQLDatabaseAdapter)) return;

        await database.persist(plainToClass(user, { username: 'peter' }));
        await database.persist(plainToClass(user, { username: 'marie' }));

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
    },
    async testRawWhere(databaseFactory: DatabaseFactory) {
        const user = t.schema({
            id: t.number.primary.autoIncrement,
            username: t.string
        }, { name: 'test_connection_user' });

        const database = await databaseFactory([user]);
        if (!isDatabaseOf(database, SQLDatabaseAdapter)) return;

        if (isDatabaseOf(database, SQLDatabaseAdapter)) {
            await database.persist(plainToClass(user, { username: 'peter' }), plainToClass(user, { username: 'marie' }), plainToClass(user, { username: 'mueller' }));

            {
                const result = await database.query(user).where(sql`id
                > 1`).findOne();
                expect(result).toMatchObject({ id: 2, username: 'marie' });
            }

            {
                const id = 1;
                const result = await database.query(user).where(sql`id
                =
                ${id}`).findOne();
                expect(result).toMatchObject({ id: 1, username: 'peter' });
            }

            {
                const id = 3;
                const result = await database.query(user).filter({ id: { $gt: 1 } }).where(sql`${identifier('id')}
                <
                ${id}`).find();
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
                console.log('result', result);
                expect(result.count).toBe(3);
            }
        }
    },
    async testSelfReference(databaseFactory: DatabaseFactory) {
        @entity.name('explorer/block').collectionName('blocks')
        class ExplorerBlock {
            @t.primary.autoIncrement public id: number = 0;

            @t level: number = 0;
            @t transactions: number = 0;

            constructor(
                @t public hash: Uint8Array,
                @t public created: Date,
                @t.reference().optional public previous?: ExplorerBlock
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

        const blocks = await database.query(ExplorerBlock).sort({id: 'desc'}).find();

        for (const block of blocks) {
            expect(isReference(block)).toBe(false);
            if (block.previous) {
                expect(block.previous).toBeInstanceOf(ExplorerBlock);
                expect(isReference(block.previous)).toBe(true);
            }
            expect(block.level).toBeGreaterThan(0);
        }
    }
};
