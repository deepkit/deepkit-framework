


# Getting Started

Deepkit provides a Database ORM that allows databases to be accessed in a modern way.
Entities are simply defined using TypeScript types:

```typescript
import { entity, PrimaryKey, AutoIncrement, 
    Unique, MinLength, MaxLength } from '@deepkit/type';

type Username = string & Unique & MinLength<2> & MaxLength<16>;

// class entity
@entity.name('user')
class User {
    id: number & PrimaryKey & AutoIncrement = 0;
    created: Date = new Date;
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

const database = new Database(new MySQLDatabaseAdapter({
    host: 'localhost',
    port: 3306
}), [User]);
```

### Postgres

```sh
npm install @deepkit/orm @deepkit/postgres
```

```typescript
import { PostgresDatabaseAdapter } from '@deepkit/postgres';

const database = new Database(new PostgresDatabaseAdapter({
    host: 'localhost',
    port: 3306
}), [User]);
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
import { SQLiteDatabaseAdapter } from '@deepkit/sqlite';
import { entity, PrimaryKey, AutoIncrement } from '@deepkit/type';
import { Database } from '@deepkit/orm';

async function main() {
    @entity.name('user')
    class User {
        public id: number & PrimaryKey & AutoIncrement = 0;
        created: Date = new Date;

        constructor(public name: string) {
        }
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

```bash
npm install @deepkit/mongo
```

```typescript
import { MongoDatabaseAdapter } from '@deepkit/mongo';

const database = new Database(
    new MongoDatabaseAdapter('mongodb://localhost:27017/myapp'),
    [User]
);
```

## Testing Setup

For testing, we recommend using `SQLiteDatabaseAdapter` with in-memory databases for the best balance of performance and SQL feature support:

```typescript
import { SQLiteDatabaseAdapter } from '@deepkit/sqlite';

// In your test files
describe('User tests', () => {
    let database: Database;

    beforeEach(async () => {
        // Use SQLite in-memory database for testing
        database = new Database(new SQLiteDatabaseAdapter(':memory:'), [User]);
        await database.migrate();
    });

    afterEach(async () => {
        await database.disconnect();
    });

    test('should create user', async () => {
        const user = new User('testuser', 'test@example.com');
        await database.persist(user);

        const found = await database.query(User).findOne();
        expect(found.username).toBe('testuser');
    });
});
```

> **Note**: While `MemoryDatabaseAdapter` is available for simple tests, `SQLiteDatabaseAdapter` with `:memory:` is recommended as it provides full SQL compatibility and better represents production behavior.

## Quick Start Example

Here's a complete example to get you started:

```typescript
import { entity, PrimaryKey, AutoIncrement, MinLength } from '@deepkit/type';
import { Database } from '@deepkit/orm';
import { SQLiteDatabaseAdapter } from '@deepkit/sqlite';

@entity.name('user')
class User {
    id: number & PrimaryKey & AutoIncrement = 0;
    created: Date = new Date();

    constructor(
        public username: string & MinLength<3>,
        public email: string
    ) {}
}

@entity.name('post')
class Post {
    id: number & PrimaryKey & AutoIncrement = 0;
    created: Date = new Date();

    constructor(
        public author: User & Reference,
        public title: string,
        public content: string
    ) {}
}

async function main() {
    // Setup database
    const database = new Database(
        new SQLiteDatabaseAdapter('./blog.sqlite'),
        [User, Post]
    );

    // Create tables
    await database.migrate();

    // Create user
    const user = new User('john_doe', 'john@example.com');
    await database.persist(user);

    // Create post
    const post = new Post(user, 'My First Post', 'Hello, World!');
    await database.persist(post);

    // Query data
    const posts = await database.query(Post)
        .joinWith('author')
        .find();

    console.log('Posts:', posts);

    // Using session for multiple operations
    const session = database.createSession();

    const foundUser = await session.query(User).findOne();
    foundUser.username = 'john_updated';

    const newPost = new Post(foundUser, 'Second Post', 'More content!');
    session.add(newPost);

    await session.commit(); // Saves both changes

    await database.disconnect();
}

main().catch(console.error);
```

## Plugins

Deepkit ORM supports a plugin system for extending functionality. Some built-in plugins include:

### Soft Delete Plugin
```typescript
import { SoftDeletePlugin } from '@deepkit/orm';

const database = new Database(adapter, entities);
database.registerPlugin(new SoftDeletePlugin());
```

### Log Plugin
```typescript
import { LogPlugin } from '@deepkit/orm';

const database = new Database(adapter, entities);
database.registerPlugin(new LogPlugin());
```

## Next Steps

- Learn about [Entities](entity.md) and how to define them
- Understand [Queries](query.md) and filtering
- Explore [Relations](relations.md) between entities
- Master [Sessions](session.md) for efficient operations
- Set up [Testing](testing.md) for your application

