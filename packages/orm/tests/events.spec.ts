import { expect, test } from '@jest/globals';
import { Database } from '../src/database';
import { MemoryDatabaseAdapter } from '../src/memory-db';
import { getClassSchema, t } from '@deepkit/type';

test('onUpdate plugin', async () => {
    function onUpdate() {
        return t.data('timestamp/onUpdate', true);
    }

    class TimestampPlugin {
        static register(database: Database) {
            database.unitOfWorkEvents.onUpdatePre.subscribe(event => {
                for (const property of event.classSchema.getProperties()) {
                    if (!property.data['timestamp/onUpdate']) continue;
                    for (const item of event.changeSets) {
                        item.changes.set(property.name, new Date);
                    }
                }
            });
        }
    }

    class User {
        @t.primary.autoIncrement id: number = 0;

        @t createdAt: Date = new Date;

        @t logins: number = 0;

        @t
        @onUpdate()
        updatedAt: Date = new Date;

        constructor(@t public username: string) {
        }
    }

    const database = new Database(new MemoryDatabaseAdapter(), [User]);
    TimestampPlugin.register(database);

    const user1 = new User('peter');
    const date1 = user1.updatedAt;
    await database.persist(user1);

    {
        const session = database.createSession();
        const user2 = await session.query(User).filter(user1).findOne();
        expect(user2.updatedAt).toEqual(date1);
        expect(user1 !== user2).toBe(true);

        user2.logins++;
        await session.commit();

        const user3 = await session.query(User).filter(user1).findOne();
        expect(user3.updatedAt).not.toEqual(date1);
    }


    const schema = getClassSchema(User);
    expect(schema.getProperty('updatedAt').data['timestamp/onUpdate']).toBe(true);

});
