# Entity

An entity is either a class or an object literal (interface) and always has a primary key.
The entity is decorated with all necessary information using type annotations from `@deepkit/type`. For example, a primary key is defined as well as various fields and their validation constraints. These fields reflect the database structure, usually a table or a collection.

Through special type annotations like `Mapped<'name'>` a field name can also be mapped to another name in the database.

## Class

```typescript
import { AutoIncrement, MaxLength, MinLength, PrimaryKey, Unique, entity } from '@deepkit/type';

@entity.name('user')
class User {
  id: number & PrimaryKey & AutoIncrement = 0;
  created: Date = new Date();
  firstName?: string;
  lastName?: string;

  constructor(
    public username: string & Unique & MinLength<2> & MaxLength<16>,
    public email: string & Unique,
  ) {}
}

const database = new Database(new SQLiteDatabaseAdapter(':memory:'), [User]);
await database.migrate();

await database.persist(new User('Peter'));

const allUsers = await database.query(User).find();
console.log('all users', allUsers);
```

## Interface

```typescript
import { PrimaryKey, AutoIncrement, Unique, MinLength, MaxLength } from '@deepkit/type';

interface User {
    id: number & PrimaryKey & AutoIncrement = 0;
    created: Date = new Date;
    firstName?: string;
    lastName?: string;
    username: string & Unique & MinLength<2> & MaxLength<16>;
}

const database = new Database(new SQLiteDatabaseAdapter(':memory:'));
database.register<User>({name: 'user'});

await database.migrate();

const user: User = {id: 0, created: new Date, username: 'Peter'};
await database.persist(user);

const allUsers = await database.query<User>().find();
console.log('all users', allUsers);
```

## Primitives

Primitive data types like String, Number (bigint), and Boolean are mapped to common database types. Only the TypeScript type is used.

```typescript
interface User {
  logins: number;
  username: string;
  pro: boolean;
}
```

## Primary Key

Each entity needs exactly one primary key. Multiple primary keys are not supported.

The base type of a primary key can be arbitrary. Often a number or UUID is used.
For MongoDB the MongoId or ObjectID is often used.

For numbers `AutoIncrement` can be used.

```typescript
import { PrimaryKey } from '@deepkit/type';

interface User {
  id: number & PrimaryKey;
}
```

## Auto Increment

Fields that should be automatically incremented during insertion are annotated with the `AutoIncrement` decorator. All adapters support auto-increment values. The MongoDB adapter uses an additional collection to keep track of the counter.

An auto-increment field is an automatic counter and can only be applied to a primary key. The database automatically ensures that an ID is used only once.

```typescript
import { AutoIncrement, PrimaryKey } from '@deepkit/type';

interface User {
  id: number & PrimaryKey & AutoIncrement;
}
```

## UUID

Fields that should be of type UUID (v4) are annotated with the decorator UUID. The runtime type is `string` and mostly binary in the database itself. Use the `uuid()` function to create a new UUID v4.

```typescript
import { PrimaryKey, UUID, uuid } from '@deepkit/type';

class User {
  id: UUID & PrimaryKey = uuid();
}
```

## MongoDB ObjectID

Fields that should be of type ObjectID in MongoDB are annotated with the decorator `MongoId`. The runtime type is `string` and in the database itself `ObjectId` (binary).

MongoID fields automatically get a new value when inserted. It is not mandatory to use the field name `_id`. It can have any name.

```typescript
import { MongoId, PrimaryKey } from '@deepkit/type';

class User {
  id: MongoId & PrimaryKey = '';
}
```

## Optional / Nullable

Optional fields are declared as TypeScript type with `title?: string` or `title: string | null`. You should use only one variant of this, usually the optional `?` syntax, which works with `undefined`.
Both variants result in the database type being `NULLABLE` for all SQL adapters. So the only difference between these decorators is that they represent different values at runtime.

In the following example, the changed field is optional and can therefore be undefined at runtime, although it is always represented as NULL in the database.

```typescript
import { PrimaryKey } from '@deepkit/type';

class User {
  id: number & PrimaryKey = 0;
  modified?: Date;
}
```

This example shows how the nullable type works. NULL is used both in the database and in the javascript runtime. This is more verbose than `modified?: Date` and is not commonly used.

```typescript
import { PrimaryKey } from '@deepkit/type';

class User {
  id: number & PrimaryKey = 0;
  modified: Date | null = null;
}
```

## Database Type Mapping

|===
|Runtime type|SQLite|MySQL|Postgres|Mongo

|string|text|longtext|text|string
|number|float|double|double precision|int/number
|boolean|integer(1)|boolean|boolean|boolean
|date|text|datetime|timestamp|datetime
|array|text|json|jsonb|array
|map|text|json|jsonb|object
|map|text|json|jsonb|object
|union|text|json|jsonb|T
|uuid|blob|binary(16)|uuid|binary
|ArrayBuffer/Uint8Array/...|blob|longblob|bytea|binary
|===

With `DatabaseField` it is possible to map a field to any database type. The type must be a valid SQL statement that is passed unchanged to the migration system.

```typescript
import { DatabaseField } from '@deepkit/type';

interface User {
  title: string & DatabaseField<{ type: 'VARCHAR(244)' }>;
}
```

To map a field for a specific database, either `SQLite`, `MySQL`, or `Postgres` can be used.

### SQLite

```typescript
import { SQLite } from '@deepkit/type';

interface User {
  title: string & SQLite<{ type: 'text' }>;
}
```

### MySQL

```typescript
import { MySQL } from '@deepkit/type';

interface User {
  title: string & MySQL<{ type: 'text' }>;
}
```

### Postgres

```typescript
import { Postgres } from '@deepkit/type';

interface User {
  title: string & Postgres<{ type: 'text' }>;
}
```

## Embedded Types

## Default Values

## Default Expressions

## Complex Types

## Exclude

## Database Specific Column Types
