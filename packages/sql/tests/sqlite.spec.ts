import 'jest';
import 'reflect-metadata';
import {SQLiteDatabaseAdapter} from '../index';
import {Entity, plainToClass, t} from '@deepkit/type';
import {createSetup} from './setup';

test('sqlite basic', async () => {
    const User = t.schema({
        id: t.number.primary,
        name: t.string,
        created: t.date,
    }, {name: 'user'});

    const database = await createSetup(new SQLiteDatabaseAdapter(':memory:'), [User]);

    const user1 = plainToClass(User, {id: 1, name: 'Yes', created: new Date()});
    const user2 = plainToClass(User, {id: 2, name: 'Wow', created: new Date()});
    const user3 = plainToClass(User, {id: 3, name: 'asdadasd', created: new Date()});

    {
        const session = database.createSession();

        expect(await session.query(User).count()).toBe(0);

        session.add(user1, user2, user3);
        await session.commit();
        expect(await session.query(User).count()).toBe(3);

        user1.name = 'Changed';
        await session.commit();
        expect(await session.query(User).count()).toBe(3);
        expect((await session.query(User).disableIdentityMap().filter(user1).findOne()).name).toBe('Changed');
    }

    {
        const session = database.createSession();
        const user1db = await session.query(User).filter({id: user1.id}).findOne();
        expect(user1db.name).toBe('Changed');
    }

    {
        const session = database.createSession();
        expect((await session.query(User).deleteMany()).modified).toBe(3);
        expect((await session.query(User).deleteMany()).modified).toBe(0);
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
