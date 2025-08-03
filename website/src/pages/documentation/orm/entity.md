# Entity

An entity represents a data model that maps to a database table or collection. It defines the structure, constraints, and relationships of your data using TypeScript types and decorators. Entities are the foundation of your application's data layer.

## What is an Entity?

An entity is a TypeScript class or interface that:
- **Represents a business concept** (User, Product, Order, etc.)
- **Maps to a database table/collection**
- **Has exactly one primary key**
- **Defines field types and constraints**
- **Can have relationships to other entities**

### Entity Design Principles

1. **Single Responsibility**: Each entity should represent one clear business concept
2. **Data Integrity**: Use type constraints to enforce business rules
3. **Normalization**: Avoid data duplication through proper relationships
4. **Performance**: Consider indexing for frequently queried fields

## Entity Definition Methods

Deepkit ORM supports two approaches for defining entities: classes (recommended) and interfaces.

## Class-Based Entities (Recommended)

Classes provide the most flexibility and are the recommended approach for defining entities. They support methods, computed properties, and provide better IDE support.

```typescript
import { entity, PrimaryKey, AutoIncrement, Unique, MinLength, MaxLength } from '@deepkit/type';

@entity.name('user')
class User {
    id: number & PrimaryKey & AutoIncrement = 0;
    created: Date = new Date;
    firstName?: string;
    lastName?: string;

    constructor(
        public username: string & Unique & MinLength<2> & MaxLength<16>,
        public email: string & Unique,
    ) {}

    // Business logic methods
    getFullName(): string {
        return `${this.firstName || ''} ${this.lastName || ''}`.trim();
    }

    isActive(): boolean {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        return this.created > thirtyDaysAgo;
    }
}

const database = new Database(new SQLiteDatabaseAdapter(':memory:'), [User]);
await database.migrate();

const user = new User('peter_doe', 'peter@example.com');
user.firstName = 'Peter';
user.lastName = 'Doe';

await database.persist(user);

const allUsers = await database.query(User).find();
console.log('Full name:', allUsers[0].getFullName()); // "Peter Doe"
```

### Benefits of Class-Based Entities

- **Methods**: Add business logic directly to entities
- **Computed Properties**: Calculate derived values
- **Type Safety**: Full TypeScript support with IntelliSense
- **Inheritance**: Share common functionality between entities
- **Validation**: Custom validation logic in methods

## Interface-Based Entities

Interfaces provide a lightweight approach when you only need data structure without methods. They're useful for simple data models or when working with external APIs.

```typescript
import { PrimaryKey, AutoIncrement, Unique, MinLength, MaxLength } from '@deepkit/type';

interface User {
    id: number & PrimaryKey & AutoIncrement;
    created: Date;
    firstName?: string;
    lastName?: string;
    username: string & Unique & MinLength<2> & MaxLength<16>;
    email: string & Unique;
}

const database = new Database(new SQLiteDatabaseAdapter(':memory:'));
database.register<User>({ name: 'user' });

await database.migrate();

const user: User = {
    id: 0,
    created: new Date(),
    username: 'peter_doe',
    email: 'peter@example.com'
};

await database.persist(user);

const allUsers = await database.query<User>().find();
console.log('all users', allUsers);
```

### When to Use Interfaces

**Use interfaces when:**
- You need simple data structures without behavior
- Working with external APIs or data sources
- Building lightweight microservices
- You prefer functional programming patterns

**Use classes when:**
- You need business logic methods
- You want computed properties
- You need complex validation
- You're building rich domain models

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
import { PrimaryKey, AutoIncrement } from '@deepkit/type';

interface User {
    id: number & PrimaryKey & AutoIncrement;
}
```

## UUID

Fields that should be of type UUID (v4) are annotated with the decorator UUID. The runtime type is `string` and mostly binary in the database itself. Use the `uuid()` function to create a new UUID v4.

```typescript
import { uuid, UUID, PrimaryKey } from '@deepkit/type';

class User {
    id: UUID & PrimaryKey = uuid();
}
```

## MongoDB ObjectID

Fields that should be of type ObjectID in MongoDB are annotated with the decorator `MongoId`. The runtime type is `string` and in the database itself `ObjectId` (binary).

MongoID fields automatically get a new value when inserted. It is not mandatory to use the field name `_id`. It can have any name.

```typescript
import { PrimaryKey, MongoId } from '@deepkit/type';

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
    title: string & DatabaseField<{type: 'VARCHAR(244)'}>;
}
```

To map a field for a specific database, either `SQLite`, `MySQL`, or `Postgres` can be used.

### SQLite

```typescript
import { SQLite } from '@deepkit/type';

interface User {
    title: string & SQLite<{type: 'text'}>;
}
```

### MySQL

```typescript
import { MySQL } from '@deepkit/type';

interface User {
    title: string & MySQL<{type: 'text'}>;
}
```

### Postgres

```typescript
import { Postgres } from '@deepkit/type';

interface User {
    title: string & Postgres<{type: 'text'}>;
}
```

## Embedded Types

## Default Values

## Database Field Options

The `DatabaseField` decorator provides fine-grained control over how fields are handled in the database:

```typescript
import { DatabaseField, entity, PrimaryKey, AutoIncrement } from '@deepkit/type';

@entity.name('user')
class User {
    id: number & PrimaryKey & AutoIncrement = 0;

    // Skip field during inserts (useful for computed columns)
    username: string & DatabaseField<{ skip: true }> = '';

    // Custom column name
    email: string & DatabaseField<{ name: 'email_address' }> = '';

    // Skip during updates only
    createdAt: Date & DatabaseField<{ skipUpdate: true }> = new Date();

    // Skip during inserts only
    updatedAt: Date & DatabaseField<{ skipInsert: true }> = new Date();

    constructor(username: string, email: string) {
        this.username = username;
        this.email = email;
    }
}
```

## Embedded Objects

Deepkit ORM supports embedded objects for complex data structures:

```typescript
interface Address {
    street: string;
    city: string;
    zipCode: string;
    country: string;
}

interface ContactInfo {
    phone?: string;
    website?: string;
    socialMedia: {
        twitter?: string;
        linkedin?: string;
    };
}

@entity.name('company')
class Company {
    id: number & PrimaryKey & AutoIncrement = 0;

    // Embedded object
    address: Address = {
        street: '',
        city: '',
        zipCode: '',
        country: ''
    };

    // Nested embedded objects
    contact: ContactInfo = {
        socialMedia: {}
    };

    constructor(public name: string) {}
}

// Usage
const company = new Company('Tech Corp');
company.address = {
    street: '123 Main St',
    city: 'San Francisco',
    zipCode: '94105',
    country: 'USA'
};

company.contact = {
    phone: '+1-555-0123',
    website: 'https://techcorp.com',
    socialMedia: {
        twitter: '@techcorp',
        linkedin: 'company/techcorp'
    }
};

await database.persist(company);

// Query embedded fields
const companies = await database.query(Company)
    .filter({ 'address.city': 'San Francisco' })
    .find();
```

## Advanced Validation

Combine multiple validation constraints for robust data integrity:

```typescript
import {
    entity, PrimaryKey, AutoIncrement,
    MinLength, MaxLength, Pattern, Positive,
    validate, ValidatorError
} from '@deepkit/type';

// Custom validator function
function ValidAge(min: number = 0, max: number = 150) {
    return (value: number): ValidatorError | void => {
        if (value < min || value > max) {
            return new ValidatorError('age', `Age must be between ${min} and ${max}`);
        }
    };
}

@entity.name('user')
class User {
    id: number & PrimaryKey & AutoIncrement = 0;

    // Multiple string constraints
    username: string & MinLength<3> & MaxLength<20> & Pattern<'^[a-zA-Z0-9_]+$'> = '';

    // Email validation
    email: string & Pattern<'^[^@]+@[^@]+\.[^@]+$'> = '';

    // Custom validation
    @t.validate(ValidAge(13, 120))
    age: number & Positive = 0;

    // Optional field with validation
    website?: string & Pattern<'^https?://.*'>;

    constructor(username: string, email: string, age: number) {
        this.username = username;
        this.email = email;
        this.age = age;
    }
}

// Validation is automatically applied during persist operations
try {
    const user = new User('ab', 'invalid-email', -5); // Invalid data
    await database.persist(user);
} catch (error) {
    console.log('Validation errors:', error.message);
}
```

## Complex Types and Arrays

Handle arrays and complex data types:

```typescript
@entity.name('blog_post')
class BlogPost {
    id: number & PrimaryKey & AutoIncrement = 0;

    // Array of strings
    tags: string[] = [];

    // Array of numbers
    ratings: number[] = [];

    // Array of embedded objects
    comments: Array<{
        author: string;
        content: string;
        createdAt: Date;
        likes: number;
    }> = [];

    // JSON field for flexible data
    metadata: Record<string, any> = {};

    // Binary data
    thumbnail?: Uint8Array;

    constructor(
        public title: string,
        public content: string,
        public authorId: number
    ) {}
}

// Usage
const post = new BlogPost('My First Post', 'Hello World!', 1);
post.tags = ['javascript', 'typescript', 'deepkit'];
post.comments = [
    {
        author: 'John',
        content: 'Great post!',
        createdAt: new Date(),
        likes: 5
    }
];
post.metadata = {
    featured: true,
    category: 'tutorial',
    readTime: 5
};

await database.persist(post);

// Query array fields
const jsPosts = await database.query(BlogPost)
    .filter({ tags: { $in: ['javascript'] } })
    .find();
```

## Exclude Fields

Exclude sensitive or computed fields from database operations:

```typescript
import { Exclude } from '@deepkit/type';

@entity.name('user')
class User {
    id: number & PrimaryKey & AutoIncrement = 0;
    username: string = '';
    email: string = '';

    // Excluded from database operations
    password: string & Exclude<'database'> = '';

    // Computed field - not stored in database
    get displayName(): string & Exclude<'database'> {
        return `${this.firstName} ${this.lastName}`;
    }

    // Temporary field for business logic
    isNewUser: boolean & Exclude<'database'> = false;

    constructor(username: string, email: string) {
        this.username = username;
        this.email = email;
    }
}
```
