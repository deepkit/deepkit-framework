import { AutoIncrement, Email, entity, MaxLength, MinLength, PrimaryKey, Reference, Unique } from '@deepkit/type';
import { Database } from '@deepkit/orm';
import { SQLiteDatabaseAdapter } from '@deepkit/sqlite';
import { Config } from './config';

@entity.name('user')
export class User {
    id: number & PrimaryKey & AutoIncrement = 0;
    created: Date = new Date;
    image?: Uint8Array;

    constructor(
        public username: string & MinLength<3> & Unique
    ) {
    }
}

@entity.name('author')
export class Author {
    id: number & PrimaryKey & AutoIncrement = 0;
    created: Date = new Date;

    email?: string & Email & MaxLength<100>;

    firstName?: string & MaxLength<100>;
    lastName?: string & MaxLength<100>;

    birthDate?: Date;

    constructor(
        public username: string & MinLength<3> & MaxLength<24> & Unique
    ) {
    }
}

enum BookStatus {
    reserved,
    published,
    revoked,
}

@entity.name('book')
export class Book {
    id: number & PrimaryKey & AutoIncrement = 0;
    created: Date = new Date;

    status: BookStatus = BookStatus.reserved;

    description: string & MaxLength<4096> = '';

    price: number = 0;
    isbn: string & MaxLength<64> = '';

    constructor(
        public author: Author & Reference,
        public title: string & MaxLength<128> & MinLength<3>,
    ) {
    }
}

export class SQLiteDatabase extends Database {
    constructor(dbPath: Config['dbPath']) {
        // super(new MongoDatabaseAdapter('mongodb://localhost/example-app'), [User, Book, Author]);
        super(new SQLiteDatabaseAdapter(dbPath), [User, Book, Author]);
    }
}
