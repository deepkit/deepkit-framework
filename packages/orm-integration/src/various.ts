import { expect } from '@jest/globals';
import { plainToClass, t } from '@deepkit/type';
import { identifier, sql, SQLDatabaseAdapter } from '@deepkit/sql';
import { DatabaseFactory } from './test';
import { isDatabaseOf } from '@deepkit/orm';

export const variousTests = {
    async testRawQuery(databaseFactory: DatabaseFactory) {
        const user = t.schema({
            id: t.number.primary.autoIncrement,
            username: t.string
        }, { name: 'test_connection_user' });

        const database = await databaseFactory([user]);

        await database.persist(plainToClass(user, { username: 'peter' }));
        await database.persist(plainToClass(user, { username: 'marie' }));

        {
            const result = await database.raw(sql`SELECT count(*) as count FROM ${user}`).findOne();
            expect(result.count).toBe(2);
        }

        {
            const result = await database.createSession().raw(sql`SELECT count(*) as count FROM ${user}`).findOne();
            expect(result.count).toBe(2);
        }

        {
            const id = 1;
            const result = await database.createSession().raw(sql`SELECT count(*) as count FROM ${user} WHERE id > ${id}`).findOne();
            expect(result.count).toBe(1);
        }

        {
            const result = await database.raw(sql`SELECT * FROM ${user}`).find();
            expect(result).toEqual([
                { id: 1, username: 'peter' },
                { id: 2, username: 'marie' },
            ]);
        }

        {
            const result = await database.createSession().raw(sql`SELECT * FROM ${user}`).find();
            expect(result).toEqual([
                { id: 1, username: 'peter' },
                { id: 2, username: 'marie' },
            ]);
        }

        await database.raw(sql`DELETE FROM ${user}`).execute();

        {
            const result = await database.raw(sql`SELECT count(*) as count FROM ${user}`).findOne();
            expect(result.count).toBe(0);
        }
    },
    async testRawWhere(databaseFactory: DatabaseFactory) {
        const user = t.schema({
            id: t.number.primary.autoIncrement,
            username: t.string
        }, { name: 'test_connection_user' });

        const database = await databaseFactory([user]);

        if (isDatabaseOf(database, SQLDatabaseAdapter)) {
            await database.persist(plainToClass(user, { username: 'peter' }), plainToClass(user, { username: 'marie' }), plainToClass(user, { username: 'mueller' }));

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
                const result = await database.query(user).filter({id: {$gt: 1}}).where(sql`${identifier('id')} < ${id}`).find();
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
    }
};
