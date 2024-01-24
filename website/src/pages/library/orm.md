---
title: Deepkit ORM
package: '@deepkit/type'
doc: orm/getting-started
api: orm
category: orm
---

<p class="introduction">
One of the fastest TypeScript ORM for MongoDB, MySQL, PostgreSQL, SQLite.
With Data Mapper, optional Active Record, Unit Of Work, Identity Map, migrations, relations support, and much more.
Use plain TypeScript — no code-generation, schema, or config files required.
</p>

## Features

<div class="app-boxes-small">
    <box title="Runtime Types">Use just regular TypeScript for entity definition.</box>
    <box title="Validation">Built-In validation for even the most complex types.</box>
    <box title="Typesafe Query">Easy to use query API.</box>
    <box title="Relation">Relation support with real joins, even for MongoDB.</box>
    <box title="Unit Of Work">Unit Of Work with Identity Map for fast and efficient transactions and batching.</box>
    <box title="Typesafe Raw SQL">Deserializes and validates even raw SQL queries.</box>
    <box title="ActiveRecord">Optional ActiveRecord support for fast prototyping.</box>
    <box title="Event System">Event system for powerful plugins and customizations.</box>
    <box title="Migrations">Migration system to automatically create up/down migrations.</box>
</div>

<feature>

## Runtime TypeScript Types

Write your ORM entities as regular TypeScript classes or interfaces, and annotate properties with database specific features. It's that simple.

Use complex types like mapped types, conditional types, unions, generics, and more. Deepkit ORM supports almost all TypeScript features.

With full support for nominal classes including constructor arguments and methods.

```typescript
import { AutoIncrement, Email, Index, MinLength, PrimaryKey, Unique } from '@deepkit/type';

type Username = string & MinLength<3> & Unique;

class User {
  id: number & PrimaryKey & AutoIncrement = 0;
  createdAt: Date = new Date();

  lastName?: string;
  firstName?: string;

  email?: string & Email & Index;

  constructor(public username: Username) {}
}
```

</feature>

<feature class="right">

## Interfaces as Entities

You prefer interfaces to classes? No problem. Deepkit ORM supports interfaces as entities.

Use both classes or interfaces in your application. Deepkit ORM automatically converts them to the correct type.

```typescript
import { AutoIncrement, Email, Index, MinLength, PrimaryKey, Unique } from '@deepkit/type';

interface User {
  id: number & PrimaryKey;
  createdAt: Date;
  lastName?: string;
  firstName?: string;
  email?: string & Email & Index;
  username: string & MinLength<3> & Unique;
}
```

</feature>

<feature>

## Database Abstraction

Simple yet powerful Database abstraction layer with adapters for MongoDB, MySQL, PostgreSQL, and SQLite.

Write your own adapter for any other database system or create as many database connections as you want.

```typescript
import { Database } from '@deepkit/orm';
import { SQLiteDatabaseAdapter } from '@deepkit/sqlite';

const adapter = new SQLiteDatabaseAdapter(':memory:');
const database = new Database(adapter);
database.registerEntity(User);

await database.migrate(); //creates tables, indexes, etc.

const user = new User('Peter');
await database.persist(user); //inserts the user
user.id; //is now set
```

</feature>

<feature class="right">

## Query API

The query API allows you to fetch and manipulate data in a typesafe manner.

Filtering uses a Mongo-Like query interface, that works for every database (even SQL) the same.

The API is designed to build cross-database queries that work on every database the same.

```typescript
const user = await database.query(User)
    .filter({username: 'Peter')
    .findOne(); //returns User class instance

const users = await database.query(User)
    .orderBy('lastLogin')
    .limit(10)
    .find(); //returns array of User class instance

const users = await database.query(User)
    //Mongo-Like queries for cross-databases queries
    // lastLogin > 10 ($gt = greater than)
    .filter({lastLogin: {$gt: 10})
    .limit(10)
    .find();

//aggregation queries: Get user count in each group
const users = await database.query(User)
    .groupBy('group')
    .withCount('id', 'users')
    .find(); // [{group: 'teamA', users: 5}]

const result = await database.query(User)
    .orderBy('createdAt')
    .limit(5)
    .patchMany({credit: {$inc: 100}});
//reports affected records, e.g. [1, 2, 3, 4, 5]
result.primaryKeys;
//also returns the new credit value
result.returning.credit; //e.g. [100, 200, 100, 300, 100]

const result = await database.query(User)
    .filter({disabled: true})
    .deleteMany();
//reports affected records, e.g. [1, 2, 3, 4, 5]
result.primaryKeys;
```

</feature>

<feature>

## Raw SQL Query

You want to use the full power of SQL? No problem. Deepkit ORM supports typesafe raw SQL queries.

All parameters are automatically serialized and returned records are deserialized and validated to the correct type.

```typescript
import { sql } from '@deepkit/sql';

const username = 'Peter';

//users is now an array of User class instances
const users = await database.raw<User>(sql`
    SELECT * FROM user WHERE username = ${username}
`).find();


// or partial raw queries, to get full support of joins, etc.
const users = await database.query(User)
    .where(sql`username = ${username}`)
    .find();
```

</feature>

<feature class="right">

## Relations

Define your relations in terms of object references, and let Deepkit ORM handle the rest.

Support in all directions: One-To-One, One-To-Many, Many-To-One, Many-To-Many, and all databases
including MongoDB.

```typescript
class Author {
    id: number & PrimaryKey = 0;
    //.. more fields
    books: Book[] & BackReference = [];
}

class Book {
    id: number & PrimaryKey = 0;
    //.. more fields
    constructor(
        public title: string,
        public author: Author & Reference,
    ) {}
}

const books = await database.query(Book)
    .joinWith('author')
    .find();
for (const book of books) {
    //access the eagerly loaded relation
    book.author.username;
}

const books = await database.query(Book)
    .useInnerJoinWith('author')
        //add additional filter to the join
        .filter({username: 'Peter'})
    .end()
    .find();
```

</feature>

<feature>

## Event System

You can hook into Unit of Work sessions or query execution using asynchronous event listeners that are able to modify the query itself.

This allows you to write plugins or change the behavior of your entities in every way you want.

```typescript
// onFetch is called for find(), findOne(), findOneOrUndefined()
database.listen(Query.onFetch, async event => {
  if (event.isSchemaOf(User)) {
    //modify the query
    event.query = event.query.addFilter({ deleted: false });
  }
});

// onDeletePost is called after
// deleteOne()/deleteMany() successfully executed
database.listen(Query.onDeletePost, async event => {
  //primaryKeys contains each primary key for
  //all affected records
  for (const id of event.deleteResult.primaryKeys) {
    await event.databaseSession.persist(new AuditLog('deleted', event.classSchema.getName()));
  }
});
```

</feature>

<feature class="right">

## Migrations

Migrations help you migrate schema changes for SQL databases in an easy yet effective way.

The migration file is automatically generated based on the difference between the actual schema of your database and your schema defined in your TypeScript code.

You can modify the generated schema migration as you wish and commit to Git, so your colleagues and deploy procedure can update the database schema correctly.

```typescript
class User {
    id: number & PrimaryKey & AutoIncrement = 0;
    username: string = '';
}

//version 2 adds new fields
class User {
    id: number & PrimaryKey & AutoIncrement = 0;
    username: string = '';
    lastName: string = '';
    firstName: string = '';
}
```

```typescript title=my-app/migration/20200917-1727.ts
import { Migration } from '@deepkit/framework';

export class SchemaMigration implements Migration {
  up() {
    return [`ALTER TABLE "user" ADD COLUMN "lastName" TEXT``ALTER TABLE "user" ADD COLUMN "firstName" TEXT`];
  }

  down() {
    return [`ALTER TABLE "user" DROP COLUMN "lastName"``ALTER TABLE "user" DROP COLUMN "firstName"`];
  }
}
```

</feature>

<feature>

## ActiveRecord

For prototyping purposes Deepkit ORM also supports the ActiveRecord pattern.

It allows you to directly work with the entity class, without accessing a Database object.

```typescript
import { ActiveRecord } from '@deepkit/orm';
import { PrimaryKey } from '@deepkit/type';

class User extends ActiveRecord {
  id: number & PrimaryKey = 0;
  createdAt: Date = new Date();
  //...
}

const user = new User('Marie');
await user.save();

const users = await User.query()
  .filter({ logins: { $gt: 10 } })
  .find();

for (const user of users) {
  user.credit += 10;
  await user.save();
}
```

</feature>
