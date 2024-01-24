# Getting Started

Deepkit provides a Database ORM that allows databases to be accessed in a modern way.
Entities are simply defined using TypeScript types:

```typescript
import { AutoIncrement, MaxLength, MinLength, PrimaryKey, Unique, entity } from '@deepkit/type';

type Username = string & Unique & MinLength<2> & MaxLength<16>;

// class entity
@entity.name('user')
class User {
  id: number & PrimaryKey & AutoIncrement = 0;
  created: Date = new Date();
  firstName?: string;
  lastName?: string;

  constructor(
    public username: Username,
    public email: string & Unique,
  ) {}
}

// or as interface
interface User {
  id: number & PrimaryKey & AutoIncrement;
  created: Date;
  firstName?: string;
  lastName?: string;
  username: Username;
  email: string & Unique;
}
```

Any TypeScript types and validation decorators from Deepkit can be used to fully define the entity.
The entity type system is designed in such a way that these types or classes can also be used in other areas such as HTTP routes, RPC actions or frontend. This prevents, for example, that one has defined a user several times distributed in the entire application.

## Installation

Since Deepkit ORM is based on Runtime Types, it is necessary to have `@deepkit/type` already installed correctly. See [Runtime Type Installation](runtime-types/getting-started.md).

If this is done successfully, `@deepkit/orm` itself and a database adapter can be installed.

If classes are to be used as entities, `experimentalDecorators` must be enabled in tsconfig.json:

```json
{
  "compilerOptions": {
    "experimentalDecorators": true
  }
}
```

Once the library is installed, a database adapter can be installed and the API of it can be used directly.

### SQLite

```sh
npm install @deepkit/orm @deepkit/sqlite
```

```typescript
import { SQLiteDatabaseAdapter } from '@deepkit/sqlite';

const database = new Database(new SQLiteDatabaseAdapter('./example.sqlite'), [User]);
const database = new Database(new SQLiteDatabaseAdapter(':memory:'), [User]);
```

### MySQL

```sh
npm install @deepkit/orm @deepkit/mysql
```

```typescript
import { MySQLDatabaseAdapter } from '@deepkit/mysql';

const database = new Database(
  new MySQLDatabaseAdapter({
    host: 'localhost',
    port: 3306,
  }),
  [User],
);
```

### Postgres

```sh
npm install @deepkit/orm @deepkit/postgres
```

```typescript
import { PostgresDatabaseAdapter } from '@deepkit/postgres';

const database = new Database(
  new PostgresDatabaseAdapter({
    host: 'localhost',
    port: 3306,
  }),
  [User],
);
```

### MongoDB

```sh
npm install @deepkit/orm @deepkit/bson @deepkit/mongo
```

```typescript
import { MongoDatabaseAdapter } from '@deepkit/mongo';

const database = new Database(new MongoDatabaseAdapter('mongodb://localhost/mydatabase'), [User]);
```

## Usage

Primarily the `Database` object is used. Once instantiated, it can be used throughout the application to query or manipulate data. The connection to the database is initialized lazy.

The `Database` object is passed an adapter, which comes from the database adapters libraries.

```typescript
import { Database } from '@deepkit/orm';
import { SQLiteDatabaseAdapter } from '@deepkit/sqlite';
import { AutoIncrement, PrimaryKey, entity } from '@deepkit/type';

async function main() {
  @entity.name('user')
  class User {
    public id: number & PrimaryKey & AutoIncrement = 0;
    created: Date = new Date();

    constructor(public name: string) {}
  }

  const database = new Database(new SQLiteDatabaseAdapter('./example.sqlite'), [User]);
  await database.migrate(); //create tables

  await database.persist(new User('Peter'));

  const allUsers = await database.query(User).find();
  console.log('all users', allUsers);
}

main();
```

### Database

### Connection

#### Read Replica

## Repository

## Index

## Case Sensitivity

## Character Sets

## Collations

## Batching

## Caching

## Multitenancy

## Naming Strategy

## Locking

### Optimistic Locking

### Pessimistic Locking

## Custom Types

## Logging

## Migration

## Seeding

## Raw Database Access

### SQL

### MongoDB

## Plugins
