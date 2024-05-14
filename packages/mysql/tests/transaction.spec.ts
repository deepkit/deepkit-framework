import { expect, test } from '@jest/globals';
import { AutoIncrement, entity, PrimaryKey } from '@deepkit/type';
import { databaseFactory } from './factory.js';

test('transaction', async () => {
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
        const user = await session.query(User).filter({ username: 'user1' }).findOne();

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

    database.disconnect();
});
