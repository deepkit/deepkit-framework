import 'reflect-metadata';
import { AutoIncrement, Entity, entity, PrimaryKey, uuid } from '@deepkit/type';
import { Database } from '@deepkit/orm';
import { SQLiteDatabaseAdapter } from '@deepkit/sqlite';
import { User, UserGroup } from './bookstore/user';
import { Group } from './bookstore/group';
import { UserCredentials } from './bookstore/user-credentials';
import { Reference } from '@deepkit/type';
import { UUID } from '@deepkit/type';
//import { MongoDatabaseAdapter } from '@deepkit/mongo';


class BookModeration {
    locked: boolean = false;

    maxDate?: Date;

    admin?: User;

    moderators: User[] = [];
}

@entity.name('book')
class Book {
    id: number & PrimaryKey & AutoIncrement = 0;

    created: Date = new Date;

    moderation: BookModeration = new BookModeration;

    constructor(
        public author: User & Reference,
        public title: string,
    ) {
    }
}

@entity.name('image')
class Image {
    id: UUID & PrimaryKey = uuid();

    downloads: number = 0;

    tags: string[] = [];

    privateToken: UUID = uuid();

    image: Uint8Array = new Uint8Array();

    constructor(public path: string) {
    }
}

enum ReviewStatus {
    published,
    revoked,
    hidden,
}

@entity.name('review')
class Review {
    id: number & PrimaryKey & AutoIncrement = 0;
    created: Date = new Date;
    stars: number = 0;
    status: ReviewStatus = ReviewStatus.published;

    constructor(
        public user: User & Reference,
        public book: Book & Reference,
    ) {
    }
}

export interface GroupInterface extends Entity<{collection: 'interfaceGroups'}> {
    id: number & PrimaryKey & AutoIncrement;
    created: Date;
    name: string;
}

const database = new Database(new SQLiteDatabaseAdapter('./example.sqlite'), [User, UserCredentials, Book, Review, Image, Group, UserGroup]).register<Group>();
// const database = new Database(new MySQLDatabaseAdapter({database: 'orm-example', user: 'root'}), [User, UserCredentials, Book, Review, Image, Group, UserGroup]);
// const database = new Database(new PostgresDatabaseAdapter({database: 'orm-example', user: 'postgres'}), [User, UserCredentials, Book, Review, Image, Group, UserGroup]);
//const database = new Database(new MongoDatabaseAdapter('mongodb://localhost'), [User, UserCredentials, Book, Review, Image, Group, UserGroup]);
database.logger.enableLogging();
