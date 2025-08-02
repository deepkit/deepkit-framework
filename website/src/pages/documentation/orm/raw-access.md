# Raw Access

Raw access allows you to execute database-specific queries when the ORM's query builder doesn't provide the functionality you need. This is particularly useful for complex queries, database-specific features, or performance-critical operations.

## SQL Databases

For SQL databases, use the `sql` template literal to create safe, parameterized queries:

```typescript
import { PrimaryKey, AutoIncrement, entity } from '@deepkit/type';
import { Database } from '@deepkit/orm';
import { sql, identifier } from '@deepkit/sql';
import { SQLiteDatabaseAdapter } from '@deepkit/sqlite';

@entity.name('user')
class User {
    id: number & PrimaryKey & AutoIncrement = 0;
    created: Date = new Date;
    username: string = '';
    email: string = '';
    age: number = 0;
}

const database = new Database(new SQLiteDatabaseAdapter(':memory:'), [User]);

// Basic query with parameters
const searchTerm = 'Pet%';
const users = await database.raw<User>(sql`
    SELECT * FROM user
    WHERE username LIKE ${searchTerm}
`).find();

// Count query
const result = await database.raw<{ count: number }>(sql`
    SELECT count(*) as count
    FROM user
    WHERE username LIKE ${searchTerm}
`).findOne();
console.log('Found', result.count, 'users');
```

### Advanced SQL Examples

```typescript
// Complex aggregation query
type UserStats = {
    ageGroup: string;
    userCount: number;
    avgAge: number;
};

const stats = await database.raw<UserStats>(sql`
    SELECT
        CASE
            WHEN age < 18 THEN 'Under 18'
            WHEN age BETWEEN 18 AND 30 THEN '18-30'
            WHEN age BETWEEN 31 AND 50 THEN '31-50'
            ELSE 'Over 50'
        END as ageGroup,
        COUNT(*) as userCount,
        AVG(age) as avgAge
    FROM user
    GROUP BY ageGroup
    ORDER BY avgAge
`).find();

// Window functions (PostgreSQL/MySQL)
type UserRanking = {
    id: number;
    username: string;
    age: number;
    ageRank: number;
};

const rankings = await database.raw<UserRanking>(sql`
    SELECT
        id,
        username,
        age,
        ROW_NUMBER() OVER (ORDER BY age DESC) as ageRank
    FROM user
    WHERE age > 18
`).find();
```

## SQL Template Literals

The `sql` template literal provides safe parameterization and prevents SQL injection attacks. All values are automatically escaped and converted to prepared statement parameters.

### Dynamic Identifiers

For dynamic column names or table names, you can use the `identifier()` function from `@deepkit/sql`:

```typescript
import { identifier, sql } from '@deepkit/sql';

// Dynamic column selection
const column = 'username';
const sortColumn = 'created';
const users = await database.raw<User>(sql`
    SELECT ${identifier(column)}
    FROM user
    WHERE ${identifier(column)} LIKE ${'Pet%'}
    ORDER BY ${identifier(sortColumn)} DESC
`).find();

// For most cases, you can reference columns directly in the template
const users2 = await database.raw<User>(sql`
    SELECT username, email
    FROM user
    WHERE username LIKE ${'Pet%'}
    ORDER BY created DESC
`).find();
```

### Entity References in SQL

You can reference entity classes directly in SQL queries:

```typescript
// Use entity class as table reference
const users = await database.raw<User>(sql`
    SELECT * FROM ${User}
    WHERE age > ${18}
`).find();

// Join with multiple entities
@entity.name('order')
class Order {
    id: number & PrimaryKey & AutoIncrement = 0;
    userId: number & Reference<User> = 0;
    amount: number = 0;
}

type UserOrderSummary = {
    username: string;
    totalOrders: number;
    totalAmount: number;
};

const summary = await database.raw<UserOrderSummary>(sql`
    SELECT
        u.username,
        COUNT(o.id) as totalOrders,
        SUM(o.amount) as totalAmount
    FROM ${User} u
    LEFT JOIN ${Order} o ON u.id = o.userId
    GROUP BY u.id, u.username
    HAVING totalOrders > 0
`).find();
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
import { MongoDatabaseAdapter } from '@deepkit/mongo';

const database = new Database(MongoDatabaseAdapter('mongodb://localhost:27017/mydatabase'));

// first argument is entry point collection, second is the command's return type
const items = await database.raw<ChatMessage, { count: number }>([
    { $match: { roomId: 'room1' } },
    { $group: { _id: '$userId', count: { $sum: 1 } } },
]).find();
```
