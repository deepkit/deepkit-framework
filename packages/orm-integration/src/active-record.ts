import { expect } from '@jest/globals';
import { User, UserGroup } from './bookstore/user.js';
import { Book } from './active-record/book.js';
import { Tag } from './active-record/tag.js';
import { BookTag } from './active-record/book-tag.js';
import { Group } from './bookstore/group.js';
import { DatabaseFactory } from './test.js';

export const activeRecordTests = {
    async basics(databaseFactory: DatabaseFactory) {
        const database = await databaseFactory([User, Book, Tag, BookTag]);
        const user1 = new User('peter');
        const book1 = new Book(user1, 'My book');
        await book1.save();

        expect(await Book.query().count()).toBe(1);

        expect(await Book.query().count()).toBe(1);
        expect(await Book.query().count()).toBe(1);

        await book1.remove();

        expect(await Book.query().count()).toBe(0);
        expect(await database.query(User).count()).toBe(1);
        database.disconnect();
    },

    async secondLevelJoin(databaseFactory: DatabaseFactory) {
        const database = await databaseFactory([Group, UserGroup, User, Book, Tag, BookTag]);
        const user1 = new User('peter');
        const book1 = new Book(user1, 'My book');
        await book1.save();

        const user2 = new User('Herbert');
        const book2 = new Book(user2, 'Herberts book');
        await book2.save();

        const group1 = new Group('group1');
        await database.persist(new UserGroup(user1, group1));

        expect(await database.query(Group).count()).toBe(1);
        expect(await database.query(UserGroup).count()).toBe(1);
        expect(await database.query(User).count()).toBe(2);

        {
            const books = await Book.query().useInnerJoinWith('author').innerJoinWith('groups').end().find();
            expect(books.length).toBe(1); //because user1 has no group assigned
            const book1Db = books[0];
            expect(book1Db.author.name).toBe('peter');
            expect(book1Db.author.groups.length).toBe(1);
            expect(book1Db.author.groups[0]).toBeInstanceOf(Group);
            expect(book1Db.author.groups[0].name).toBe('group1');
        }

        {
            await database.persist(new UserGroup(user2, group1));
            const books = await Book.query().useInnerJoinWith('author').innerJoinWith('groups').end().find();
            expect(books.length).toBe(2); //because user1 has now a group
            const book1Db = books[0];
            expect(book1Db.title).toBe('My book');
            expect(book1Db.author.name).toBe('peter');
            expect(book1Db.author.groups.length).toBe(1);
            expect(book1Db.author.groups[0].name).toBe('group1');

            const book2Db = books[1];
            expect(book2Db.title).toBe('Herberts book');
            expect(book2Db.author.name).toBe('Herbert');
            expect(book2Db.author.groups.length).toBe(1);
            expect(book2Db.author.groups[0].name).toBe('group1');
        }
        database.disconnect();
    },

    async manyToMany(databaseFactory: DatabaseFactory) {
        const database = await databaseFactory([User, Book, Tag, BookTag]);
        const user1 = new User('peter');
        const book1 = new Book(user1, 'My book');
        await book1.save();

        const tagNew = new Tag('new');
        const tagAssignment = new BookTag(book1, tagNew);
        await tagAssignment.save();

        {
            const books = await Book.query().joinWith('tags').find();
            expect(books.length).toBe(1);
            const book1DB = books[0];
            expect(book1DB.author.id).toBe(user1.id);
            expect(book1DB.tags.length).toBe(1);
            expect(book1DB.tags[0].name).toBe('new');
            expect(book1DB.tags[0].id).toBe(tagNew.id);
        }

        const tagHot = new Tag('hot');
        await new BookTag(book1, tagHot).save();

        {
            const books = await Book.query().joinWith('tags').find();
            expect(books.length).toBe(1);
            const book1DB = books[0];
            expect(book1DB.author.id).toBe(user1.id);
            expect(book1DB.tags.length).toBe(2);
            expect(book1DB.tags[0].name).toBe('new');
            expect(book1DB.tags[0].id).toBe(tagNew.id);
            expect(book1DB.tags[1].name).toBe('hot');
            expect(book1DB.tags[1].id).toBe(tagHot.id);
        }
        database.disconnect();
    },
};
