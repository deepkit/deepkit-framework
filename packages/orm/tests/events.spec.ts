import { expect, test } from '@jest/globals';
import { Database } from '../src/database.js';
import { MemoryDatabaseAdapter } from '../src/memory-db.js';
import { AutoIncrement, PrimaryKey, ReflectionClass, t } from '@deepkit/type';
import { DatabaseSession } from '../src/database-session.js';
import { DatabasePersistence } from '../src/database-adapter.js';
import { DatabaseErrorEvent, DatabaseErrorInsertEvent, DatabaseErrorUpdateEvent, onDatabaseError } from '../src/event.js';
import { assertDefined, assertInstanceOf } from '@deepkit/core';

test('onUpdate plugin', async () => {
    function onUpdate() {
        return t.data('timestamp/onUpdate', true);
    }

    class TimestampPlugin {
        static register(database: Database) {
            database.listen(DatabaseSession.onUpdatePre, event => {
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
        id: number & PrimaryKey & AutoIncrement = 0;

        createdAt: Date = new Date;

        logins: number = 0;

        @onUpdate()
        updatedAt: Date = new Date;

        constructor(public username: string) {
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


    const schema = ReflectionClass.from(User);
    expect(schema.getProperty('updatedAt').data['timestamp/onUpdate']).toBe(true);

});

test('error insert event', async () => {
    class User {
        constructor(
            public id: number & PrimaryKey,
            public username: string,
        ) {
        }
    }

    class FailAdapter extends MemoryDatabaseAdapter {
        createPersistence(): DatabasePersistence {
            return Object.assign(super.createPersistence(), {
                insert() {
                    throw new Error('oops');
                },
            });
        }
    }

    const database = new Database(new FailAdapter(), [User]);

    let event: DatabaseErrorEvent | undefined;
    database.listen(onDatabaseError, e => event = e);

    await database.persist(new User(1, 'peter')).catch(() => undefined);

    assertDefined(event);
    assertInstanceOf(event, DatabaseErrorInsertEvent);
    expect(event.error.message).toBe('oops');
    expect(event.inserts.length).toBe(1);
    assertInstanceOf(event.inserts[0], User);
    expect(event.inserts[0]).toMatchObject({ id: 1, username: 'peter' })
});


test('error update event', async () => {
    class User {
        constructor(
            public id: number & PrimaryKey,
            public username: string,
        ) {
        }
    }

    class FailAdapter extends MemoryDatabaseAdapter {
        createPersistence(): DatabasePersistence {
            return Object.assign(super.createPersistence(), {
                update() {
                    throw new Error('oops');
                },
            });
        }
    }

    const database = new Database(new FailAdapter(), [User]);

    let event: DatabaseErrorEvent | undefined;
    database.listen(onDatabaseError, e => event = e);

    const item = new User(1, 'peter');
    await database.persist(item);
    item.username = 'changed';
    await database.persist(item).catch(() => undefined);

    assertDefined(event);
    assertInstanceOf(event, DatabaseErrorUpdateEvent);
    expect(event.error.message).toBe('oops');
    expect(event.changeSets.length).toBe(1);
    expect(event.changeSets[0].changes.$set).toEqual({ username: 'changed' });
});
