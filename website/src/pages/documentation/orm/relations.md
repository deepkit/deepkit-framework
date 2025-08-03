# Relations

Relations define how entities are connected to each other, representing the relationships between different types of data in your application. They are fundamental to relational database design and allow you to model complex data structures efficiently.

## Understanding Relations

In database terms, relations are implemented using foreign keys - fields that reference the primary key of another table. Deepkit ORM abstracts this complexity while providing type-safe access to related data.

### Key Concepts

**Reference**: The actual foreign key field that stores the connection to another entity. Annotated with `Reference`.

**BackReference**: A virtual property that provides reverse navigation from the referenced entity back to the referencing entities. Annotated with `BackReference`.

**Owning Side**: The entity that contains the foreign key field (the `Reference`). This side controls the relationship.

**Inverse Side**: The entity that is referenced, typically containing a `BackReference` for navigation.

### Why Use Relations?

- **Data Integrity**: Ensure referential integrity through foreign key constraints
- **Normalization**: Avoid data duplication by storing related data in separate entities
- **Query Efficiency**: Join related data efficiently at the database level
- **Type Safety**: Get compile-time checking for relationship navigation

## One-to-Many Relations

A one-to-many relationship means that one entity can be associated with multiple instances of another entity, but each instance of the second entity belongs to only one instance of the first entity.

### Common Examples
- **User → Posts**: One user can write many posts, but each post has one author
- **Category → Products**: One category contains many products, but each product belongs to one category
- **Department → Employees**: One department has many employees, but each employee works in one department

### Implementation

The entity that stores the foreign key is called the **owning side**:

```typescript
import { SQLiteDatabaseAdapter } from '@deepkit/sqlite';
import { entity, PrimaryKey, AutoIncrement, Reference } from '@deepkit/type';
import { Database } from '@deepkit/orm';

@entity.name('user')
class User {
    id: number & PrimaryKey & AutoIncrement = 0;
    created: Date = new Date;

    constructor(public username: string) {
    }
}

@entity.name('post')
class Post {
    id: number & PrimaryKey & AutoIncrement = 0;
    created: Date = new Date;

    constructor(
        public author: User & Reference,  // Foreign key to User
        public title: string,
        public content: string = ''
    ) {
    }
}
```

### Database Structure

This creates the following database structure:
- `user` table: `id`, `username`, `created`
- `post` table: `id`, `author` (foreign key to user.id), `title`, `content`, `created`

### Creating Related Data

```typescript
const database = new Database(new SQLiteDatabaseAdapter(':memory:'), [User, Post]);
await database.migrate();

// Create user first
const user = new User('john_doe');
await database.persist(user);

// Create posts referencing the user
const post1 = new Post(user, 'Introduction to TypeScript');
const post2 = new Post(user, 'Advanced ORM Patterns');

await database.persist(post1, post2);
```

### Important Notes

- **References are not loaded by default**: When you query for posts, the `author` field contains only the foreign key value, not the full User object
- **Use joins to load references**: See [Database Joins](./query.md#join) for details on loading related data
- **Foreign key constraints**: The database ensures that the referenced user exists

## Many-to-One Relations (Back References)

A back reference provides navigation from the "one" side back to the "many" side of a relationship. It's a virtual property that doesn't exist in the database but allows you to query related entities efficiently.

### Understanding Back References

Back references are **virtual** - they don't create database fields but enable:
- **Reverse navigation**: Navigate from User to their Posts
- **Query joins**: Include related data in queries
- **Type safety**: Compile-time checking for relationship navigation

### Adding Back References

```typescript
@entity.name('user')
class User {
    id: number & PrimaryKey & AutoIncrement = 0;
    created: Date = new Date;

    // Virtual property - not stored in database
    posts?: Post[] & BackReference;

    constructor(public username: string) {
    }
}

@entity.name('post')
class Post {
    id: number & PrimaryKey & AutoIncrement = 0;
    created: Date = new Date;

    constructor(
        public author: User & Reference,  // Actual foreign key
        public title: string
    ) {
    }
}
```

### Using Back References in Queries

```typescript
// Load users with their posts
const usersWithPosts = await database.query(User)
    .select('username', 'posts')
    .joinWith('posts')  // Load the related posts
    .find();

// Result: [{ username: 'john_doe', posts: [Post, Post, ...] }]

// Filter users by their posts
const activeAuthors = await database.query(User)
    .useJoinWith('posts')
        .filter({ created: { $gte: new Date('2023-01-01') } })
        .end()
    .find();
```

### When to Use Back References

**Use back references when:**
- You need to navigate from the "one" side to the "many" side
- You want to filter or sort by related entity properties
- You need to load related data efficiently

**Skip back references when:**
- You only navigate from "many" to "one" (use Reference only)
- The relationship is rarely used in queries
- You want to keep the entity interface minimal

## Many To Many

A many-to-many relationship allows you to associate many records with many others. For example, it can be used for users in groups. A user can be in none, one or many groups. Consequently, a group can contain 0, one or many users.

Many-to-many relationships are usually implemented using a pivot entity. The pivot entity contains the actual own references to two other entities, and these two entities have back references to the pivot entity.

```typescript
@entity.name('user')
class User {
    id: number & PrimaryKey & AutoIncrement = 0;
    created: Date = new Date;

    groups?: Group[] & BackReference<{via: typeof UserGroup}>;

    constructor(public username: string) {
    }
}

@entity.name('group')
class Group {
    id: number & PrimaryKey & AutoIncrement = 0;

    users?: User[] & BackReference<{via: typeof UserGroup}>;

    constructor(public name: string) {
    }
}

//the pivot entity
@entity.name('userGroup')
class UserGroup {
    id: number & PrimaryKey & AutoIncrement = 0;

    constructor(
        public user: User & Reference,
        public group: Group & Reference,
    ) {
    }
}
```

With these entities, you can now create users and groups and connect them to the pivot entity. By using a back reference in User, we can retrieve the groups directly with a User query.

```typescript
const database = new Database(new SQLiteDatabaseAdapter(':memory:'), [User, Group, UserGroup]);
await database.migrate();

const user1 = new User('User1');
const user2 = new User('User2');
const group1 = new Group('Group1');

await database.persist(user1, user2, group1, new UserGroup(user1, group1), new UserGroup(user2, group1));

//[
//   { id: 1, username: 'User1', groups: [ [Group] ] },
//   { id: 2, username: 'User2', groups: [ [Group] ] }
// ]
const users = await database.query(User)
    .select('username', 'groups')
    .joinWith('groups')
    .find();
```

To unlink a user from a group, the UserGroup record is deleted:

```typescript
const users = await database.query(UserGroup)
    .filter({user: user1, group: group1})
    .deleteOne();
```

## One To One

A one-to-one relationship connects exactly one record in one entity to exactly one record in another entity. In Deepkit ORM, one-to-one relationships are implemented using `Reference` on the owning side and `BackReference` on the referenced side.

### Basic One-to-One Relationship

The most common pattern is where one entity has a reference to another, and the referenced entity has a back reference:

```typescript
@entity.name('user')
class User {
    id: number & PrimaryKey & AutoIncrement = 0;

    // Back reference to the credentials
    credentials?: UserCredentials & BackReference;

    constructor(public name: string) {
    }
}

@entity.name('user-credentials')
class UserCredentials {
    password: string = '';

    constructor(
        // Reference to the user - this is the owning side
        public user: User & PrimaryKey & Reference
    ) {
    }
}
```

In this example, `UserCredentials` owns the relationship by storing a reference to `User` as its primary key. The `User` entity has a virtual back reference to access the credentials.

### Primary Key as Foreign Key

A common pattern for one-to-one relationships is to use the referenced entity's primary key as both the primary key and foreign key of the referencing entity:

```typescript
@entity.name('phoneNumber')
class PhoneNumber {
    id: number & PrimaryKey & AutoIncrement = 0;

    // Back reference to sim details
    details?: SimDetails & BackReference;

    constructor(public msisdn: string) {
    }

    country: string = '';
    active: boolean = true;
}

@entity.name('simDetails')
class SimDetails {
    // The phone number reference serves as both primary key and foreign key
    constructor(
        public number: PhoneNumber & Reference & PrimaryKey
    ) {
    }

    iccid: string = '';
    imsi: string = '';
    pin: string = '';
    puk: string = '';
}
```

This pattern ensures that each `SimDetails` record is uniquely associated with exactly one `PhoneNumber`.

### Working with One-to-One Relations

Creating and persisting one-to-one related entities:

```typescript
const database = new Database(
    new SQLiteDatabaseAdapter(':memory:'),
    [User, UserCredentials]
);
await database.migrate();

// Create entities
const user = new User('john_doe');
const credentials = new UserCredentials(user);
credentials.password = 'securePassword123';

// Persist both entities
await database.persist(user, credentials);
```

### Querying One-to-One Relations

To load the related entity, use `joinWith()`:

```typescript
// Load user with credentials
const userWithCredentials = await database.query(User)
    .joinWith('credentials')
    .filter({ name: 'john_doe' })
    .findOne();

console.log(userWithCredentials.credentials?.password); // 'securePassword123'

// Load credentials with user
const credentialsWithUser = await database.query(UserCredentials)
    .joinWith('user')
    .filter({ password: 'securePassword123' })
    .findOne();

console.log(credentialsWithUser.user.name); // 'john_doe'
```

### Circular References

One-to-one relationships can also be circular, where entities reference each other:

```typescript
@entity.name('inventory')
class Inventory {
    id: number & PrimaryKey & AutoIncrement = 0;

    constructor(public user: User & Reference) {
    }
}

@entity.name('user')
class User {
    id: number & PrimaryKey & AutoIncrement = 0;

    // Each user has exactly one inventory
    inventory: Inventory & BackReference = new Inventory(this);
}
```

In this pattern, the entities are created together and maintain a bidirectional one-to-one relationship.

## Constraints

Foreign key constraints define what happens when a referenced record is deleted or updated. Deepkit ORM supports several constraint options that can be specified on `Reference` fields.

### Constraint Options

- **CASCADE**: When the referenced record is deleted/updated, automatically delete/update the referencing records
- **RESTRICT**: Prevent deletion/update of the referenced record if there are referencing records
- **SET NULL**: Set the reference field to null when the referenced record is deleted/updated
- **NO ACTION**: No automatic action (default behavior)
- **SET DEFAULT**: Set the reference field to its default value when the referenced record is deleted/updated

### Using CASCADE

The `CASCADE` constraint is particularly useful for maintaining data integrity in one-to-one and one-to-many relationships:

```typescript
@entity.name('user')
class User {
    id: number & PrimaryKey & AutoIncrement = 0;

    constructor(public name: string) {
    }
}

@entity.name('profile')
class Profile {
    id: number & PrimaryKey & AutoIncrement = 0;

    constructor(
        // When user is deleted, profile will be automatically deleted
        public user: User & Reference<{onDelete: 'CASCADE'}>
    ) {
    }
}
```

### Constraint Examples

```typescript
// SET NULL: Reference becomes null when target is deleted
class Post {
    author?: User & Reference<{onDelete: 'SET NULL'}>;
}

// RESTRICT: Prevents deletion of user if posts exist
class Post {
    author: User & Reference<{onDelete: 'RESTRICT'}>;
}

// SET DEFAULT: Uses default value when target is deleted
class Post {
    author: User & Reference<{onDelete: 'SET DEFAULT'}> = defaultUser;
}
```

When no constraint is specified, the default behavior is `CASCADE` for most relationships.
