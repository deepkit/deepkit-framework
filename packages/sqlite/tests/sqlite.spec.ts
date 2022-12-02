import { expect, test } from '@jest/globals';
import { SQLitePlatform } from '../src/sqlite-platform';
import { databaseFactory } from './factory';
import { User, UserCredentials } from '@deepkit/orm-integration';
import { SQLiteDatabaseAdapter, SQLiteDatabaseTransaction } from '../src/sqlite-adapter';
import { sleep } from '@deepkit/core';
import { AutoIncrement, cast, Entity, entity, PrimaryKey, Reference, ReflectionClass, serialize, typeOf, UUID, uuid } from '@deepkit/type';
import { Database, DatabaseEntityRegistry } from '@deepkit/orm';
import { BackReference } from '@deepkit/type';

test('reflection circular reference', () => {
    const user = ReflectionClass.from(User);
    const credentials = ReflectionClass.from(UserCredentials);

    expect(user.getProperty('credentials').isBackReference()).toBe(true);
    expect(user.getProperty('credentials').getResolvedReflectionClass()).toBe(credentials);
    const userProperty = credentials.getProperty('user');
    expect(userProperty.getResolvedReflectionClass()).toBe(user);
    expect(userProperty.isPrimaryKey()).toBe(true);
    expect(userProperty.isReference()).toBe(true);
});

test('tables', () => {
    const [user] = new SQLitePlatform().createTables(DatabaseEntityRegistry.from([User]));
    expect(user.getColumn('birthdate').isNotNull).toBe(false);

    const [userCredentials] = new SQLitePlatform().createTables(DatabaseEntityRegistry.from([UserCredentials, User]));
    expect(userCredentials.getColumn('user').isPrimaryKey).toBe(true);
    expect(userCredentials.getColumn('user').type).toBe('integer');
});

test('class basic', async () => {
    class Product {
        id: number & PrimaryKey = 0;
        created: Date = new Date;

        constructor(public name: string) {
        }
    }

    const database = await databaseFactory([Product]);

    const product1 = cast<Product>({ id: 1, name: 'Yes', created: new Date() });
    const product2 = cast<Product>({ id: 2, name: 'Wow', created: new Date() });
    const product3 = cast<Product>({ id: 3, name: 'asdadasd', created: new Date() });

    {
        const session = database.createSession();

        expect(await session.query(Product).count()).toBe(0);

        session.add(product1, product2, product3);
        await session.commit();
        expect(await session.query(Product).count()).toBe(3);

        product1.name = 'Changed';
        await session.commit();
        expect(await session.query(Product).count()).toBe(3);
        expect((await session.query(Product).disableIdentityMap().filter(product1).findOne()).name).toBe('Changed');
    }

    {
        const session = database.createSession();
        const user1db = await session.query(Product).filter({ id: product1.id }).findOne();
        expect(user1db.name).toBe('Changed');
    }

    {
        const session = database.createSession();
        expect((await session.query(Product).deleteMany()).modified).toBe(3);
        expect((await session.query(Product).deleteMany()).modified).toBe(0);
    }
});

test('interface basic', async () => {
    interface Product extends Entity<{ name: 'product' }> {
        id: number & PrimaryKey;
        name: string;
        created: Date;
    }

    const database = await databaseFactory([typeOf<Product>()]);

    const product1: Product = { id: 1, name: 'Yes', created: new Date() };
    const product2: Product = { id: 2, name: 'Wow', created: new Date() };
    const product3: Product = { id: 3, name: 'asdadasd', created: new Date() };

    {
        const session = database.createSession();

        expect(await session.query<Product>().count()).toBe(0);

        session.add(product1, product2, product3);
        await session.commit();
        expect(await session.query<Product>().count()).toBe(3);

        product1.name = 'Changed';
        await session.commit();
        expect(await session.query<Product>().count()).toBe(3);
        expect((await session.query<Product>().disableIdentityMap().filter(product1).findOne()).name).toBe('Changed');
    }

    {
        const session = database.createSession();
        const user1db = await session.query<Product>().filter({ id: product1.id }).findOne();
        expect(user1db.name).toBe('Changed');
    }

    {
        const session = database.createSession();
        expect((await session.query<Product>().deleteMany()).modified).toBe(3);
        expect((await session.query<Product>().deleteMany()).modified).toBe(0);
    }
});

test('sqlite autoincrement', async () => {
    @entity.name('sqlite-user')
    class User {
        id?: number & PrimaryKey & AutoIncrement;
        created: Date = new Date;

        constructor(
            public name: string
        ) {
        }
    }

    const database = await databaseFactory([User]);
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
    @entity.name('sqlite-author')
    class Author {
        created: Date = new Date;

        constructor(
            public id: number & PrimaryKey,
            public name: string,
        ) {
        }
    }

    @entity.name('sqlite-book')
    class Book {
        constructor(
            public id: number & PrimaryKey,
            public author: Author & Reference,
            public name: string,
        ) {
        }
    }

    const database = await databaseFactory([Author, Book]);
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


test('transaction', async () => {
    const sqlite = new SQLiteDatabaseAdapter('app.sqlite');

    {
        const t1 = new SQLiteDatabaseTransaction();
        const c1 = await sqlite.connectionPool.getConnection(undefined, t1);
        const c2 = await sqlite.connectionPool.getConnection();

        expect(c1 === c2).toBe(false);

        c1.release(); //this doesnt release anything
        c2.release();

        expect(c1.released).toBe(false);

        {
            const c3 = await sqlite.connectionPool.getConnection();
            expect(c3 === c1).toBe(false);
        }

        c1.transaction!.ended = true;
        c1.release(); //now it can be released

        {
            const c3 = await sqlite.connectionPool.getConnection();
            expect(c3 === c1).toBe(true);
        }
    }
});

test('connection pool', async () => {
    const sqlite = new SQLiteDatabaseAdapter('app.sqlite');

    {
        const c1 = await sqlite.connectionPool.getConnection();
        const c2 = await sqlite.connectionPool.getConnection();

        expect(c1 === c2).toBe(false);

        c1.release();
        c2.release();

        const c3 = await sqlite.connectionPool.getConnection();
        expect(c3 === c1).toBe(true);
    }

    {
        const c1 = await sqlite.connectionPool.getConnection();
        const c2 = await sqlite.connectionPool.getConnection();
        const c3 = await sqlite.connectionPool.getConnection();
        const c4 = await sqlite.connectionPool.getConnection();
        const c5 = await sqlite.connectionPool.getConnection();
        const c6 = await sqlite.connectionPool.getConnection();
        const c7 = await sqlite.connectionPool.getConnection();
        const c8 = await sqlite.connectionPool.getConnection();
        const c9 = await sqlite.connectionPool.getConnection();
        const c10 = await sqlite.connectionPool.getConnection();
        // this blocks
        let c11: any;
        sqlite.connectionPool.getConnection().then((c) => {
            c11 = c;
        });
        let c12: any;
        sqlite.connectionPool.getConnection().then((c) => {
            c12 = c;
        });
        await sleep(0.01);
        expect(c11).toBe(undefined);
        expect(c12).toBe(undefined);

        c1.release();
        await sleep(0.01);
        expect(c11).toBe(c1);

        c2.release();
        await sleep(0.01);
        expect(c12).toBe(c2);
    }
});

test('optional', async () => {
    @entity.name('entity')
    class MyEntity {
        id: number & PrimaryKey & AutoIncrement = 0;
        value?: string;
    }

    const database = new Database(new SQLiteDatabaseAdapter(), [MyEntity]);
    await database.migrate();

    const entity1 = new MyEntity();
    expect('value' in entity1).toBe(false);
    expect('value' in serialize<MyEntity>(entity1)).toBe(false);

    await database.persist(entity1);

    const entity2 = await database.query(MyEntity).findOne();
    expect('value' in entity2).toBe(false);
    expect('value' in serialize<MyEntity>(entity1)).toBe(false);
});

test('uuid', async () => {
    @entity.name('my-entity')
    class MyEntity {
        id: UUID & PrimaryKey = uuid();
    }

    const database = new Database(new SQLiteDatabaseAdapter(), [MyEntity]);
    await database.migrate();
    const ent = new MyEntity();
    await database.persist(ent);
    expect(await database.query(MyEntity).count()).toBe(1);
    await database.remove(ent);
    expect(await database.query(MyEntity).count()).toBe(0);
});

test('m2m', async () => {
    class Book {
        id: number & PrimaryKey & AutoIncrement = 0;
        tags: Tag[] & BackReference<{ via: typeof BookToTag }> = [];

        constructor(public title: string) {
        }
    }

    class Tag {
        id: number & PrimaryKey & AutoIncrement = 0;
        books: Book[] & BackReference<{ via: typeof BookToTag }> = [];

        constructor(public name: string) {
        }
    }

    class BookToTag {
        id: number & PrimaryKey & AutoIncrement = 0;

        constructor(public book: Book & Reference, public tag: Tag & Reference) {
        }
    }

    const database = new Database(new SQLiteDatabaseAdapter(':memory:'), [Book, Tag, BookToTag]);
    database.logger.enableLogging();
    await database.migrate();
    const book = new Book('title');
    const tag = new Tag('name');
    const pivot = new BookToTag(book, tag);
    await database.persist(book, tag, pivot);
    const tagQueried = await database.query(Tag).join('books').findOne();
    expect(tagQueried).toMatchObject({ name: 'name' });
});

test('bool and json', async () => {
    class Model {
        id: number & PrimaryKey & AutoIncrement = 0;
        flag: boolean = false;
        doc: { flag: boolean } = { flag: false };
    }

    const database = new Database(new SQLiteDatabaseAdapter(':memory:'), [Model]);
    await database.migrate();

    {
        const m = new Model;
        m.flag = true;
        m.doc.flag = true;
        await database.persist(m);
    }

    const m = await database.query(Model).findOne();
    expect(m).toMatchObject({ flag: true, doc: { flag: true } });
});

test('change different fields of multiple entities', async () => {
    @entity.name('model2')
    class Model {
        firstName: string = '';
        lastName: string = '';
        constructor(public id: number & PrimaryKey) {
        }
    }


    const database = new Database(new SQLiteDatabaseAdapter(':memory:'), [Model]);
    await database.migrate();

    {
        const m1 = new Model(1);
        m1.firstName = 'Peter';
        await database.persist(m1);
        const m2 = new Model(2);
        m2.lastName = 'Smith';
        await database.persist(m2);
    }

    {
        const m1 = await database.query(Model).filter({id: 1}).findOne();
        const m2 = await database.query(Model).filter({id: 2}).findOne();

        m1.firstName = 'Peter2';
        m2.lastName = 'Smith2';
        await database.persist(m1, m2);
    }

    {
        const m1 = await database.query(Model).filter({id: 1}).findOne();
        const m2 = await database.query(Model).filter({id: 2}).findOne();

        expect(m1).toMatchObject({id: 1, firstName: 'Peter2', lastName: ''});
        expect(m2).toMatchObject({id: 2, firstName: '', lastName: 'Smith2'});
    }
});

test('change pk', async () => {
    @entity.name('model3')
    class Model {
        firstName: string = '';
        constructor(public id: number & PrimaryKey) {
        }
    }

    const database = new Database(new SQLiteDatabaseAdapter(':memory:'), [Model]);
    await database.migrate();

    {
        const m1 = new Model(1);
        m1.firstName = 'Peter';
        await database.persist(m1);
    }

    {
        const m1 = await database.query(Model).filter({id: 1}).findOne();
        m1.id = 2;
        await database.persist(m1);
    }

    {
        const m1 = await database.query(Model).filter({id: 2}).findOne();
        expect(m1).toMatchObject({id: 2, firstName: 'Peter'});
    }

    {
        const m1 = await database.query(Model).filter({id: 2}).findOne();
        m1.id = 3;
        m1.firstName = 'Peter2';
        await database.persist(m1);
    }

    {
        const m1 = await database.query(Model).filter({id: 3}).findOne();
        expect(m1).toMatchObject({id: 3, firstName: 'Peter2'});
    }
});
