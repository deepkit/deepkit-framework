import 'jest';
import 'reflect-metadata';
import {entity, getClassSchema, t} from '@super-hornet/marshal';
import {createEnvSetup} from '../setup';

@entity.name('author')
class Author {
    @t.primary.autoIncrement public id?: number;
    @t created: Date = new Date;

    constructor(
        @t public name: string,
    ) {
    }
}

@entity.name('book')
class Book {
    @t.primary.autoIncrement public id?: number;

    constructor(
        @t.reference() public author: Author,
        @t public title: string,
    ) {
    }
}

// @entity.name('category')
// class Category {
//     @t.primary.autoIncrement public id?: number;
//
//     constructor(
//         @t public name: string,
//     ) {
//     }
// }

test('schema', () => {
    const book = getClassSchema(Book);
    expect(book.name).toBe('book');

    const author = getClassSchema(Author);
    expect(author.name).toBe('author');
    expect(book.getProperty('author').classType).toBe(Author);
    expect(book.getProperty('author').getResolvedClassSchema()).toBe(author);
});

test('basics', async () => {
    process.env['ADAPTER_DRIVER'] = 'mysql';

    const database = await createEnvSetup([Author, Book]);
    {
        const session = database.createSession();
        expect(await session.query(Author).count()).toBe(0);

        const peter = new Author('Peter');
        const herbert = new Author('Herbert');

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

        expect(await session.query(Author).count()).toBe(2);
        expect(await session.query(Book).count()).toBe(2);
    }

    {
        const session = database.createSession();
        const peter = await session.query(Author).filter({name: 'Peter'}).findOne();
        expect(peter).toBeInstanceOf(Author);
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
        const ref = session.getReference(Author, 1);
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
});


