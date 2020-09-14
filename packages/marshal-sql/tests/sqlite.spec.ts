import 'jest';
import 'reflect-metadata';
import {SQLiteDatabaseAdapter} from '../index';
import {Entity, plainSerializer, t} from '@deepkit/marshal';
import {bench} from '@deepkit/core';
import {createSetup} from './setup';

test('sqlite 10k bench', async () => {
    const User = t.class({
        id: t.primary.number,
        name: t.string,
        created: t.date,
    }, {name: 'user'});

    const database = await createSetup(new SQLiteDatabaseAdapter(':memory:'), [User]);
    const session = database.createSession();

    expect(await session.query(User).count()).toBe(0);

    for (let i = 0; i < 10_000; i++) {
        session.add(plainSerializer.for(User).deserialize({id: i, name: 'Peter' + i, created: new Date()}));
    }
    await bench(1, 'insert', async () => {
        await session.commit();
    });

    expect(await session.query(User).count()).toBe(10_000);
});

test('sqlite basic', async () => {
    const User = t.schema({
        id: t.primary.number,
        name: t.string,
        created: t.date,
    }, {name: 'user'});

    const database = await createSetup(new SQLiteDatabaseAdapter(':memory:'), [User]);

    const user1 = User.create({id: 1, name: 'Yes', created: new Date()});
    const user2 = User.create({id: 2, name: 'Wow', created: new Date()});
    const user3 = User.create({id: 3, name: 'asdadasd', created: new Date()});

    {
        const session = database.createSession();

        expect(await session.query(User).count()).toBe(0);

        session.add([user1, user2, user3]);
        await session.commit();
        expect(await session.query(User).count()).toBe(3);

        user1.name = 'Changed';
        await session.commit();
        expect(await session.query(User).count()).toBe(3);
    }

    {
        const session = database.createSession();
        const user1db = await session.query(User).filter({id: user1.id}).findOne();
        expect(user1db.name).toBe('Changed');
    }

    {
        const session = database.createSession();
        expect(await session.query(User).deleteMany()).toBe(3);
        expect(await session.query(User).deleteMany()).toBe(0);
    }
});

test('sqlite autoincrement', async () => {
    @Entity('user')
    class User {
        @t.primary.autoIncrement id?: number;
        @t created: Date = new Date;

        constructor(
            @t public name: string
        ) {
        }
    }

    const database = await createSetup(new SQLiteDatabaseAdapter(':memory:'), [User]);
    const session = database.createSession();

    expect(await session.query(User).count()).toBe(0);

    const peter = new User('Peter');
    const herbert = new User('Herbert');
    session.add(peter);
    session.add(herbert);
    await session.commit();
    expect(await session.query(User).count()).toBe(2);

    expect(peter.id).toBe(1);
    expect(herbert.id).toBe(2);

    expect(await session.query(User).count()).toBe(2);
});

test('sqlite relation', async () => {
    @Entity('author')
    class Author {
        @t created: Date = new Date;

        constructor(
            @t.primary public id: number,
            @t public name: string,
        ) {
        }
    }

    @Entity('book')
    class Book {
        constructor(
            @t.primary public id: number,
            @t.reference() public author: Author,
            @t public name: string,
        ) {
        }
    }

    const database = await createSetup(new SQLiteDatabaseAdapter(':memory:'), [Author, Book]);
    const session = database.createSession();

    expect(await session.query(Author).count()).toBe(0);

    const peter = new Author(1, 'Peter');
    const herbert = new Author(2, 'Herbert');

    session.add(peter);
    session.add(herbert);

    const book1 = new Book(1, peter, 'Peters book');
    session.add(book1);
    await session.commit();

    expect(await session.query(Author).count()).toBe(2);
    expect(await session.query(Book).count()).toBe(1);
});