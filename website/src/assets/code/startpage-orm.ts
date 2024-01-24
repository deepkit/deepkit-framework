import { Database } from '@deepkit/orm';
import { SqliteDatabaseAdapter } from '@deepkit/sql';
import { AutoIncrement, MaxLength, MinLength, PrimaryKey, Unique } from '@deepkit/type';

type Username = string & Unique & MinLength<3> & MaxLength<20>;

class User {
    id: number & AutoIncrement & PrimaryKey = 0;
    created: Date = new Date();

    constructor(public username: Username) {}
}

const database = new Database(SqliteDatabaseAdapter(':memory:'), [User]);
await database.migrate(); //create tables

database.persist(new User('Peter'));

const user = await database.query(User).find({ username: 'Peter' }).findOne();
