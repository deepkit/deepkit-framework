import 'reflect-metadata';
import { entity, t, uuid } from '@deepkit/type';
import { Database } from '@deepkit/orm';
import { SQLiteDatabaseAdapter } from '@deepkit/sqlite';
import { User, UserGroup } from './bookstore/user';
import { Group } from './bookstore/group';
import { UserCredentials } from './bookstore/user-credentials';


class BookModeration {
    @t locked: boolean = false;

    @t.optional maxDate?: Date;

    @t.optional admin?: User;

    @t.array(User) moderators: User[] = [];
}

@entity.name('book')
class Book {
    @t.primary.autoIncrement id: number = 0;

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

    @t.array(t.string) tags: string[] = [];

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
    @t.primary.autoIncrement id: number = 0;
    @t created: Date = new Date;
    @t stars: number = 0;
    @t.enum(ReviewStatus) status: ReviewStatus = ReviewStatus.published;

    constructor(
        @t.reference() public user: User,
        @t.reference() public book: Book,
    ) {
    }
}

const database = new Database(new SQLiteDatabaseAdapter('./example.sqlite'), [User, UserCredentials, Book, Review, Image, Group, UserGroup]);
database.logger.enableLogging();