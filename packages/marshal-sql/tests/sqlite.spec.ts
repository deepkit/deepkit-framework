import 'jest';
import 'reflect-metadata';
import {SQLiteDatabaseAdapter} from '../index';
import {Entity, plainSerializer, t} from '@super-hornet/marshal';
import {bench} from '@super-hornet/core';
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
    const User = t.class({
        id: t.primary.number,
        name: t.string,
        created: t.date,
    }, {name: 'user'});

    const database = await createSetup(new SQLiteDatabaseAdapter(':memory:'), [User]);
    const session = database.createSession();

    expect(await session.query(User).count()).toBe(0);

    session.add(plainSerializer.for(User).deserialize({id: 1, name: 'Yes', created: new Date()}));
    session.add(plainSerializer.for(User).deserialize({id: 2, name: 'Wow', created: new Date()}));
    session.add(plainSerializer.for(User).deserialize({id: 3, name: 'asdadasd', created: new Date()}));
    await session.commit();

    expect(await session.query(User).count()).toBe(3);
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