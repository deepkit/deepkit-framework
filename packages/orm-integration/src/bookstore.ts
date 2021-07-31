import { expect } from '@jest/globals';
import 'reflect-metadata';
import { entity, getClassSchema, plainToClass, t, uuid } from '@deepkit/type';
import { User, UserGroup } from './bookstore/user';
import { UserCredentials } from './bookstore/user-credentials';
import { atomicChange, getInstanceStateFromItem } from '@deepkit/orm';
import { isArray } from '@deepkit/core';
import { Group } from './bookstore/group';
import { DatabaseFactory } from './test';

class BookModeration {
    @t locked: boolean = false;

    @t.optional maxDate?: Date;

    @t.optional admin?: User;

    @t.array(User) moderators: User[] = [];
}

@entity.name('book')
class Book {
    @t.primary.autoIncrement public id?: number;

    @t moderation: BookModeration = new BookModeration;

    constructor(
        @t.reference() public author: User,
        @t public title: string,
    ) {
    }
}

@entity.name('image')
class Image {
    @t.primary.uuid id: string = uuid();

    @t downloads: number = 0;

    @t.uuid privateToken: string = uuid();

    @t image: Uint8Array = new Uint8Array([128, 255]);

    constructor(
        @t public path: string) {
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
        @t.reference() public user: User,
        @t.reference() public book: Book,
    ) {
    }
}

const entities = [User, UserCredentials, Book, Review, Image, Group, UserGroup];

export const bookstoreTests = {
    schema() {
        const book = getClassSchema(Book);
        expect(book.name).toBe('book');

        const user = getClassSchema(User);
        expect(user.name).toBe('user');
        expect(book.getProperty('author').classType).toBe(User);
        expect(book.getProperty('author').getResolvedClassSchema()).toBe(user);

        expect(user.getProperty('birthdate').isOptional).toBe(true);
    },

    async deleteManyParallel(databaseFactory: DatabaseFactory) {
        const database = await databaseFactory(entities);
        const session = database.createSession();

        const count = 100;
        for (let i = 0; i < count; i++) session.add(new User('User' + i));
        await session.commit();
        expect(await database.query(User).count()).toBe(count);

        //we delete in parallel to check if the connection handling is correctly implemented
        const promises: Promise<any>[] = [];
        for (let i = 0; i < count; i++) {
            promises.push(session.query(User).filter({ name: 'User' + i }).deleteOne());
        }

        await Promise.all(promises);
        expect(await database.query(User).count()).toBe(0);
    },

    async filterIn(databaseFactory: DatabaseFactory) {
        const database = await databaseFactory(entities);

        const groupA = new Group('a');
        const groupB = new Group('b');
        const groupC = new Group('c');
        await database.persist(groupA, groupB, groupC);

        {
            const items = await database.query(Group).filter({ id: groupA.id }).find();
            expect(items.length).toBe(1);
            expect(items[0].name).toBe('a');
        }

        {
            const items = await database.query(Group).filter({ id: { $in: [groupA.id] } }).find();
            expect(items.length).toBe(1);
            expect(items[0].name).toBe('a');
        }

        {
            const items = await database.query(Group).filter({ id: { $in: [groupA.id, groupB.id] } }).find();
            expect(items.length).toBe(2);
            expect(items[0].name).toBe('a');
            expect(items[1].name).toBe('b');
        }

        {
            const items = await database.query(Group).filter({ $and: [{ id: { $in: [groupA.id, groupB.id] } }] }).find();
            expect(items.length).toBe(2);
            expect(items[0].name).toBe('a');
            expect(items[1].name).toBe('b');
        }

        {
            const items = await database.query(Group).filter({ id: { $nin: [groupA.id, groupB.id] } }).find();
            expect(items.length).toBe(1);
            expect(items[0].name).toBe('c');
        }
    },

    async binary(databaseFactory: DatabaseFactory) {
        const database = await databaseFactory(entities);

        const image = new Image('/foo.jpg');
        image.image = Buffer.from('t');
        await database.persist(image);

        {
            const imageDB = await database.query(Image).filter({ id: image.id }).findOne();
            expect(imageDB.id).toBe(image.id);
            expect(imageDB.privateToken).toBe(image.privateToken);
            expect(imageDB.downloads).toBe(0);
            expect(imageDB.image).toEqual(new Uint8Array(['t'.charCodeAt(0)]));
        }

        await database.query(Image).filter({ id: image.id }).patchOne({ image: Buffer.from('s') });

        {
            const imageDB = await database.query(Image).filter({ id: image.id }).findOne();
            expect(imageDB.image).toEqual(new Uint8Array(['s'.charCodeAt(0)]));
        }
    },

    async uuid(databaseFactory: DatabaseFactory) {
        const database = await databaseFactory(entities);

        const image = new Image('/foo.jpg');
        await database.persist(image);

        {
            const imageDB = await database.query(Image).filter({ id: image.id }).findOne();
            expect(imageDB.id).toBe(image.id);
            expect(imageDB.privateToken).toBe(image.privateToken);
            expect(imageDB.downloads).toBe(0);
            expect(imageDB.image).toEqual(new Uint8Array([128, 255]));
        }

        {
            const patched = await database.query(Image).returning('path', 'privateToken', 'image').patchMany({ $inc: { downloads: 1 } });
            expect(patched.modified).toBe(1);
            expect(patched.primaryKeys).toEqual([image.id]);
            expect(patched.returning.downloads).toEqual([1]);
            expect(patched.returning.path).toEqual(['/foo.jpg']);
            expect(patched.returning.privateToken).toEqual([image.privateToken]);
            expect(patched.returning.image).toEqual([new Uint8Array([128, 255])]);
        }

        {
            const patched = await database.query(Image).returning('path', 'privateToken', 'image').patchOne({ $inc: { downloads: 1 } });
            expect(patched.modified).toBe(1);
            expect(patched.primaryKeys).toEqual([image.id]);
            expect(patched.returning.downloads).toEqual([2]);
            expect(patched.returning.path).toEqual(['/foo.jpg']);
            expect(patched.returning.privateToken).toEqual([image.privateToken]);
            expect(patched.returning.image).toEqual([new Uint8Array([128, 255])]);
        }

        {
            const deleted = await database.query(Image).deleteMany();
            expect(deleted.primaryKeys).toEqual([image.id]);
            expect(deleted.modified).toBe(1);
        }
    },

    async userGroup(databaseFactory: DatabaseFactory) {
        const database = await databaseFactory(entities);

        await database.query(User).deleteMany();
        await database.query(Group).deleteMany();
        await database.query(UserGroup).deleteMany();

        const groupA = new Group('a');
        const groupB = new Group('b');

        await database.persist(groupA, groupB);

        const addUser = async (name: string, group: Group) => {
            const user = new User(name);
            await database.persist(user);
            await database.persist(new UserGroup(user, group));
        };

        await addUser('Peter 1', groupA);
        await addUser('Peter 2', groupA);
        await addUser('Marc 1', groupA);

        await addUser('Marie', groupB);

        const allUsersInA = await database.query(User).useInnerJoin('groups').filter({ name: 'a' }).end().find();
        expect(allUsersInA.length).toBe(3);

        const allUsersInB = await database.query(User).useInnerJoin('groups').filter({ name: 'b' }).end().find();
        expect(allUsersInB.length).toBe(1);

        {
            const user = await database.query(User).filter({ name: 'Peter 1' }).findOne();
            const group = await database.query(Group).filter({ name: 'b' }).findOne();

            await database.persist(new UserGroup(user, group));

            const allUsersInB = await database.query(User).useInnerJoin('groups').filter({ name: 'b' }).end().find();
            expect(allUsersInB.length).toBe(2);
        }
    },

    async reference(databaseFactory: DatabaseFactory) {
        const database = await databaseFactory(entities);

        const peter = new User('Peter');
        const marie = new User('Marie');
        await database.persist(peter, marie);

        const book1 = new Book(peter, 'Super book');
        await database.persist(book1);

        {
            const book1 = await database.query(Book).findOne();
            expect(book1.author.id).toBe(peter.id);
            book1.author = database.getReference(User, marie.id);
            await database.persist(book1);

            const book2 = await database.query(Book).findOne();
            expect(book2.author.id).toBe(marie.id);
        }

        {
            const book = plainToClass(Book, {
                author: marie.id,
                title: 'Maries path'
            });

            expect(book.author.id).toBe(marie.id);
            await database.persist(book);

            const book1 = await database.query(Book).filter({title: 'Maries path'}).findOne();
            expect(book1.author.id).toBe(marie.id);
        }


        {
            const book = plainToClass(Book, {
                author: database.getReference(User, peter.id),
                title: 'Peters path'
            });

            expect(book.author.id).toBe(peter.id);
            await database.persist(book);

            const book1 = await database.query(Book).filter({title: 'Peters path'}).findOne();
            expect(book1.author.id).toBe(peter.id);
        }

    },
    async basics(databaseFactory: DatabaseFactory) {
        const database = await databaseFactory(entities);
        {
            const session = database.createSession();
            await session.query(User).deleteMany();

            expect(await session.query(User).count()).toBe(0);

            const peter = new User('Peter');
            const herbert = new User('Herbert');
            session.add(peter, herbert);

            const book1 = new Book(peter, 'Peters book');
            const book2 = new Book(herbert, 'Herberts book');
            session.add(book1, book2);

            await session.commit();

            expect(peter.id).toBe(1);
            expect(herbert.id).toBe(2);
            expect(book1.id).toBe(1);
            expect(book2.id).toBe(2);

            expect(await session.query(User).count()).toBe(2);
            expect(await session.query(Book).count()).toBe(2);
            {
                const ids = await session.query(Book).ids(true);
                expect(ids[0]).toBe(book1.id);
            }
            {
                const ids = await session.query(Book).ids();
                expect(ids[0].id).toBe(book1.id);
            }
        }

        {
            const session = database.createSession();
            const users = await session.query(User).find();
            for (const user of users) {
                user.logins++;
            }
            await session.commit();

            {
                const users = await database.query(User).disableIdentityMap().find();
                expect(users[0].logins).toBe(1);
                expect(users[1].logins).toBe(1);
            }
        }

        {
            const session = database.createSession();
            const peter = await session.query(User).filter({ name: 'Peter' }).findOne();
            expect(peter).toBeInstanceOf(User);
            expect(peter.name).toBe('Peter');

            const books = await session.query(Book).filter({ author: peter }).find();
            expect(books.length).toBe(1);
            const book = books[0];
            expect(book).toBeInstanceOf(Book);
            expect(book.id).toBe(1);
            expect(book.title).toBe('Peters book');
        }

        {
            const session = database.createSession();
            const ref = session.getReference(User, 1);
            const books = await session.query(Book).filter({ author: ref }).find();
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
            const peter = await session.query(User).filter({ name: 'Peter' }).findOne();
            session.remove(peter);

            await session.commit();
            expect(await session.query(User).filter({ name: 'Peter' }).has()).toBe(false);
            expect(await session.query(User).count()).toBe(1);

            //cascade foreign key deletes also the book
            expect(await session.query(Book).count()).toBe(1);
        }
    },

    async subDocuments(databaseFactory: DatabaseFactory) {
        const database = await databaseFactory(entities);
        const admin = new User('Admin');
        const peter = new User('Peter');
        const herbert = new User('Herbert');

        const session = database.createSession();
        session.add(admin, peter, herbert);

        const book1 = new Book(peter, 'Peters book');
        book1.moderation.locked = true;

        const book2 = new Book(herbert, 'Herberts book');
        book2.moderation.admin = admin;
        session.add(book1, book2);

        await session.commit();

        {
            const book1DB = await database.query(Book).filter({ author: peter }).findOne();
            expect(book1DB.title).toBe('Peters book');
            expect(book1DB.moderation === book1.moderation).toBe(false);
            expect(book1DB.moderation).toBeInstanceOf(BookModeration);
            expect(book1DB.moderation.locked).toBe(true);
        }

        {
            const book2DB = await database.query(Book).filter({ author: herbert }).findOne();
            expect(book2DB.title).toBe('Herberts book');
            expect(book2DB.moderation).toBeInstanceOf(BookModeration);
            expect(book2DB.moderation.locked).toBe(false);
            expect(book2DB.moderation.admin).toBeInstanceOf(User);
            expect(book2DB.moderation.admin?.name).toBe('Admin');
        }

        {
            const book = await database.query(Book).filter({ 'moderation.locked': true }).findOne();
            expect(book.title).toBe('Peters book');
        }
    },

    async instanceState(databaseFactory: DatabaseFactory) {
        const database = await databaseFactory(entities);
        {
            const session = database.createSession();
            expect(await session.query(User).count()).toBe(0);

            const peter = new User('Peter');
            const herbert = new User('Herbert');
            expect(getInstanceStateFromItem(peter).isKnownInDatabase()).toBe(false);
            expect(getInstanceStateFromItem(herbert).isKnownInDatabase()).toBe(false);

            session.add(peter);
            session.add(herbert);

            await session.commit();
            expect(getInstanceStateFromItem(peter).isKnownInDatabase()).toBe(true);
            expect(getInstanceStateFromItem(herbert).isKnownInDatabase()).toBe(true);
        }

        {
            const session = database.createSession();
            const [peter, herbert] = await session.query(User).find();
            expect(getInstanceStateFromItem(peter).isKnownInDatabase()).toBe(true);
            expect(getInstanceStateFromItem(herbert).isKnownInDatabase()).toBe(true);

            await session.query(User).deleteMany();
            expect(getInstanceStateFromItem(peter).isKnownInDatabase()).toBe(false);
            expect(getInstanceStateFromItem(herbert).isKnownInDatabase()).toBe(false);
        }
    },

    async primaryKeyChange(databaseFactory: DatabaseFactory) {
        const database = await databaseFactory(entities);

        const session = database.createSession();
        const user1 = new User('peter');
        const user2 = new User('herbert');

        const user1Cred = new UserCredentials(user1);
        user1Cred.password = 'secret1';

        session.add(user1, user2, user1Cred);
        await session.commit();

        {
            const creds = await database.query(UserCredentials).filter({ user: user1 }).findOne();
            expect(creds.user.id).toBe(user1.id);
        }

        const res = await database.query(UserCredentials).filter({ user: user1 }).patchOne({ user: user2 });
        expect(res.modified).toEqual(1);
        expect(res.primaryKeys).toEqual([user2.id]); //we want to new primaryKey, not the old one

        {
            const creds = await database.query(UserCredentials).filter({ user: user2 }).findOne();
            expect(creds.user.id).toBe(user2.id);
        }
    },

    async userAccount(databaseFactory: DatabaseFactory) {
        const database = await databaseFactory(entities);

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
        expect(user1Cred.user.id).toBe(1);

        {
            const creds = await database.query(UserCredentials).filter({ user: user1 }).findOne();
            expect(creds.user.id).toBe(user1.id);
        }

        {
            const session = database.createSession();
            const user1 = await session.query(User).filter({ name: 'peter' }).useInnerJoinWith('credentials').filter({ password: 'secret1' }).end().findOne();
            expect(user1.id).toBe(1);
            expect(user1.credentials!.password).toBe('secret1');

            const query = session.query(User).filter({ name: 'peter' }).useInnerJoinWith('credentials').filter({ password: 'wrongPassword' }).end();
            expect(query.getJoin('credentials').model.filter).toEqual({ password: 'wrongPassword' });
            const userWrongPw = await query.findOneOrUndefined();
            expect(userWrongPw).toBeUndefined();

            const userWrongPwButLeftJoin = await session.query(User).filter({ name: 'peter' }).useJoinWith('credentials').filter({ password: 'wrongPassword' }).end().findOne();
            expect(userWrongPwButLeftJoin.id).toBe(1);
            expect(userWrongPwButLeftJoin.credentials).toBeUndefined();
        }
    },

    async userEvents(databaseFactory: DatabaseFactory) {
        const database = await databaseFactory(entities);

        // {
        //     let insertPostCalled = 0;
        //     const sub = database.unitOfWorkEvents.onInsertPost.subscribe(() => {
        //         insertPostCalled++;
        //     });
        //     await database.persist(new User('Peter'), new User('Peter2'), new User('Peter3'));
        //     expect(insertPostCalled).toBe(1);

        //     insertPostCalled = 0;
        //     const session = database.createSession();
        //     session.add(new User('Peter'), new User('Peter2'), new User('Peter3'));
        //     session.add(new Book(new User('Peter4'), 'Peter4s book'));
        //     await session.commit();
        //     expect(insertPostCalled).toBe(2);
        //     sub.unsubscribe();
        // }

        // {
        //     const sub = database.unitOfWorkEvents.onInsertPre.subscribe((event) => {
        //         if (event.isSchemaOf(User)) {
        //             for (const item of event.items) {
        //                 item.logins = 10;
        //             }
        //         }
        //     });
        //     const user = new User('jo');
        //     await database.persist(user);
        //     expect(user.logins).toBe(10);
        //     sub.unsubscribe();
        // }

        // {
        //     const sub = database.unitOfWorkEvents.onUpdatePre.subscribe((event) => {
        //         if (event.isSchemaOf(User)) {
        //             for (const changeSet of event.changeSets) {
        //                 changeSet.changes.set('logins', 50);
        //             }
        //         }
        //     });
        //     const user = new User('jo');
        //     await database.persist(user);

        //     user.name = 'Changed';
        //     await database.persist(user);
        //     expect(user.logins).toBe(50);

        //     sub.unsubscribe();
        // }

        {
            const session = database.createSession();
            const sub1 = database.unitOfWorkEvents.onUpdatePre.subscribe((event) => {
                if (event.isSchemaOf(User)) {
                    for (const changeSet of event.changeSets) {
                        changeSet.changes.increase('version', 1);
                    }
                }
            });

            const sub2 = database.queryEvents.onPatchPre.subscribe((event) => {
                if (event.isSchemaOf(User)) {
                    event.patch.increase('version', 1);
                }
            });
            const sub3 = database.queryEvents.onPatchPost.subscribe((event) => {
                if (event.isSchemaOf(User)) {
                    expect(isArray(event.patchResult.returning['version'])).toBe(true);
                    expect(event.patchResult.returning['version']![0]).toBeGreaterThan(0);
                }
            });
            const user = new User('jo');
            session.add(user);
            await session.commit();

            user.name = 'Changed';
            await session.commit();
            expect(user.version).toBe(1);
            const dbChange1 = await database.query(User).filter(user).findOne();
            expect(dbChange1.version).toBe(1);
            expect(dbChange1.name).toBe('Changed');

            user.name = 'Changed2';
            await session.commit();
            expect(user.version).toBe(2);

            {
                await session.query(User).filter(user).patchOne({ name: 'Changed3' });
                expect(user.name).toBe('Changed3');
                expect(user.version).toBe(3);

                const userDB = await database.query(User).filter(user).findOne();
                expect(userDB.name).toBe('Changed3');
                expect(userDB.version).toBe(3);
            }

            {
                await session.query(User).filter(user).patchOne({ $inc: { logins: 10 } });
                expect(user.logins).toBe(10);
                expect(user.version).toBe(4);

                const userDB = await database.query(User).filter(user).findOne();
                expect(userDB.logins).toBe(10);
                expect(userDB.version).toBe(4);
            }

            sub1.unsubscribe();
            sub2.unsubscribe();
            sub3.unsubscribe();
        }
    },

    async enum(databaseFactory: DatabaseFactory) {
        const database = await databaseFactory(entities);

        const user = new User('Peter');
        const book = new Book(user, 'Great');

        const review = new Review(user, book);
        review.status = ReviewStatus.hidden;
        await database.persist(user, book, review);

        {
            const review = await database.query(Review).findOne();
            expect(review.user.id).toBe(user.id);
            expect(review.book.id).toBe(book.id);
            expect(review.status).toBe(ReviewStatus.hidden);
        }
    },


    async atomic(databaseFactory: DatabaseFactory) {
        const database = await databaseFactory(entities);
        {
            const user = new User('Peter');
            user.logins = 1;
            await database.persist(user);

            atomicChange(user).increase('logins', 2);
            expect(user.logins).toBe(3);
            await database.persist(user);

            expect((await database.query(User).filter(user).findOne()).logins).toBe(3);
        }

        {
            const user = new User('Peter');
            user.logins = 1;
            await database.persist(user);

            const changes = await database.query(User).filter(user).patchOne({ logins: 10 });
            expect(changes.modified).toBe(1);
            expect(changes.primaryKeys[0]).toBe(user.id);
        }

        {
            const user = new User('Peter');
            user.logins = 1;
            await database.persist(user);

            atomicChange(user).increase('logins', 2);

            const changes = await database.query(User).filter(user).patchOne({ $inc: { logins: 10 } });
            expect(changes.modified).toBe(1);
            expect(changes.primaryKeys[0]).toBe(user.id);
            expect(changes.returning['logins']![0]).toBe(11);

            await database.persist(user);
            expect(user.logins).toBe(1 + 2 + 10);

            expect((await database.query(User).filter(user).findOne()).logins).toBe(1 + 2 + 10);
        }
    },
};
