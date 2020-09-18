import 'jest';
import 'reflect-metadata';
import {entity, getClassSchema, t} from '@deepkit/type';
import {createEnvSetup} from './setup';
import {User} from './user';
import {UserCredentials} from './user-credentials';
import {SQLitePlatform} from '@deepkit/sql';

// process.env['ADAPTER_DRIVER'] = 'mysql';
// process.env['ADAPTER_DRIVER'] = 'postgres';

@entity.name('book')
class Book {
    @t.primary.autoIncrement public id?: number;

    constructor(
        @t.reference() public author: User,
        @t public title: string,
    ) {
    }
}

enum ReviewStatus {
    published,
    revoked,
    hidden,
}

@entity.name('review')
class Review {
    @t.primary.autoIncrement public id?: number;
    @t created: Date = new Date;
    @t stars: number = 0;
    @t.enum(ReviewStatus) status: ReviewStatus = ReviewStatus.published;

    constructor(
        @t public user: User,
        @t public book: Book,
    ) {
    }
}

const entities = [User, UserCredentials, Book, Review];

test('schema', () => {
    const book = getClassSchema(Book);
    expect(book.name).toBe('book');

    const user = getClassSchema(User);
    expect(user.name).toBe('user');
    expect(book.getProperty('author').classType).toBe(User);
    expect(book.getProperty('author').getResolvedClassSchema()).toBe(user);

    expect(user.getProperty('birthdate').isOptional).toBe(true);
});

test('tables', () => {
    const [user] = new SQLitePlatform().createTables([User]);
    expect(user.getColumn('birthdate').isNotNull).toBe(false);

    const [userCredentials] = new SQLitePlatform().createTables([UserCredentials, User]);
    expect(userCredentials.getColumn('user').isPrimaryKey).toBe(true);
    expect(userCredentials.getColumn('user').type).toBe('integer');

    // console.log(new SQLitePlatform().getAddTableDDL(userCredentials));
});

test('basics', async () =>{
    const database = await createEnvSetup(entities);
    {
        const session = database.createSession();
        expect(await session.query(User).count()).toBe(0);

        const peter = new User('Peter');
        const herbert = new User('Herbert');

        session.add(peter);
        session.add(herbert);

        const book1 = new Book(peter, 'Peters book');
        session.add(book1);

        const book2 = new Book(herbert, 'Herberts book');
        session.add(book2);
        await session.commit();

        expect(peter.id).toBe(1);
        expect(herbert.id).toBe(2);
        expect(book1.id).toBe(1);
        expect(book2.id).toBe(2);

        expect(await session.query(User).count()).toBe(2);
        expect(await session.query(Book).count()).toBe(2);
    }

    {
        const session = database.createSession();
        const peter = await session.query(User).filter({name: 'Peter'}).findOne();
        expect(peter).toBeInstanceOf(User);
        expect(peter.name).toBe('Peter');

        const books = await session.query(Book).filter({author: peter}).find();
        expect(books.length).toBe(1);
        const book = books[0];
        expect(book).toBeInstanceOf(Book);
        expect(book.id).toBe(1);
        expect(book.title).toBe('Peters book');
    }

    {
        const session = database.createSession();
        const ref = session.getReference(User, 1);
        const books = await session.query(Book).filter({author: ref}).find();
        expect(books.length).toBe(1);
        const book = books[0];
        expect(book.author).toBe(ref);
    }

    {
        const session = database.createSession();
        const books = await session.query(Book).innerJoinWith('author').find();
        expect(books.length).toBe(2);
        expect(books[0]).toBeInstanceOf(Book);
        expect(books[0].title).toBe('Peters book');

        expect(books[1]).toBeInstanceOf(Book);
        expect(books[1].title).toBe('Herberts book');
    }

    {
        const session = database.createSession();
        const peter = await session.query(User).filter({name: 'Peter'}).findOne();
        session.remove(peter);

        await session.commit();
        expect(await session.query(User).filter({name: 'Peter'}).has()).toBe(false);
        expect(await session.query(User).count()).toBe(1);

        //cascade foreign key deletes also the book
        expect(await session.query(Book).count()).toBe(1);
    }
});

test('user account', async () => {
    const database = await createEnvSetup(entities);
    {
        const session = database.createSession();
        const user1 = new User('peter');
        const user2 = new User('herbert');

        const user1Cred = new UserCredentials(user1);
        user1Cred.password = 'secret1';

        const user2Cred = new UserCredentials(user2);
        user2Cred.password = 'secret2';

        session.add(user1, user2, user1Cred, user2Cred);
        await session.commit();

        expect(user1.id).toBe(1);
        expect(user1Cred.user.id).toBe(1)
    }

    {
        const session = database.createSession();
        const user1 = await session.query(User).filter({name: 'peter'}).useInnerJoinWith('credentials').filter({password: 'secret1'}).end().findOne();
        expect(user1.id).toBe(1);
        expect(user1.credentials!.password).toBe('secret1');

        const userWrongPw = await session.query(User).filter({name: 'peter'}).useInnerJoinWith('credentials').filter({password: 'wrongPassword'}).end().findOneOrUndefined();
        expect(userWrongPw).toBeUndefined();

        const userWrongPwButLeftJoin = await session.query(User).filter({name: 'peter'}).useJoinWith('credentials').filter({password: 'wrongPassword'}).end().findOne();
        expect(userWrongPwButLeftJoin.id).toBe(1);
        expect(userWrongPwButLeftJoin.credentials).toBeUndefined();
    }
});
