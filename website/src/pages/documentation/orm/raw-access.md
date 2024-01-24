# Raw Access

It's often necessary to access the database directly, for example to run a SQL query that is not supported by the ORM.
This can be done using the `raw` method on the `Database` class.

```typescript
import { PrimaryKey, AutoIncrement, @entity } from '@deepkit/type';
import { Database } from '@deepkit/orm';
import { sql } from '@deepkit/sql';
import { SqliteDatabaseAdapter } from '@deepkit/sqlite';

@entity.collection('users')
class User {
    id: number & PrimaryKey & AutoIncrement = 0;
    created: Date = new Date;
    constructor(public username: string) {}
}

const database = new Database(new SQLiteDatabaseAdapter(':memory:'), [User]);

const query = 'Pet%';
const rows = await database.raw<User>(sql`SELECT * FROM users WHERE username LIKE ${query}`).find();

const result = await database.raw<{ count: number }>(sql`SELECT count(*) as count FROM users WHERE username LIKE ${query}`).findOne();
console.log('Found', result.count, 'users');
```

The SQL query is built using the `sql` template string tag. This is a special template string tag that allows to pass values as parameters. These parameters are then automatically parsed and converted to a safe prepared statement. This is important to avoid SQL injection attacks.

To pass a dynamic identifier like a column name, `identifier` can be used:

```typescript
import { identifier, sql } from '@deepkit/sql';

let column = 'username';
const rows = await database.raw<User>(sql`SELECT * FROM users WHERE ${identifier(column)} LIKE ${query}`).find();
```

For SQL adapters, the `raw` method returns an `RawQuery` with `findOne` and `find` methods to retrieve the results. To execute a SQL without returning rows like UPDATE/DELETE/etc, `execute` can be used:

```typescript
let username = 'Peter';
await database.raw(sql`UPDATE users SET username = ${username} WHERE id = 1`).execute();
```

`RawQuery` also supports getting the final SQL string and parameters, correctly formatted for the database adapter:

```typescript
const query = database.raw(sql`SELECT * FROM users WHERE username LIKE ${query}`);
console.log(query.sql);
console.log(query.params);
```

This way the SQL can be used to execute it in a different database client, for example.

## Types

Note that you can pass any type to `raw` and the result from the database will be automatically converted to that type. This is especially useful for SQL adapters, where you can pass a class and the result will be automatically converted to that class.

This has limitations though. SQL Joins are not supported this way. If you want to use joins, you have to use the ORM's query builder.

## Mongo

MongoDB adapter works a bit different since it's not based on SQL queries but on Mongo commands.

A command could be an aggregation pipeline, a find query, or a write command.

```typescript

```
