# Relations

Relationships allow you to connect two entities in a certain way. This is usually done in databases using the concept of foreign keys. Deepkit ORM supports relations for all official database adapters.

A relation is annotated with the `Reference` decorator. Usually a relation also has a reverse relation, which is annotated with the `BackReference` type, but is only needed if the reverse relation is to be used in a database query. Back references are only virtual.

## One To Many

The entity that stores a reference is usually referred to as the `owning side` or the one that `owns` the reference. The following code shows two entities with a one-to-many relationship between `User` and `Post`. This means that one `User` can have multiple `Post`. The `post` entity has the `post->user` relationship. In the database itself there is now a field `Post. "author"` that contains the primary key of `User`.

```typescript
import { SQLiteDatabaseAdapter } from '@deepkit/sqlite';
import { entity, PrimaryKey, AutoIncrement, 
    Reference } from '@deepkit/type';
import { Database } from '@deepkit/orm';

@entity.collection('users')
class User {
    id: number & PrimaryKey & AutoIncrement = 0;
    created: Date = new Date;

    constructor(public username: string) {
    }
}

@entity.collection('posts')
class Post {
    id: number & PrimaryKey & AutoIncrement = 0;
    created: Date = new Date;

    constructor(
        public author: User & Reference,
        public title: string
    ) {
    }
}

const database = new Database(
    new SQLiteDatabaseAdapter(':memory:'), 
    [User, Post]
);
await database.migrate();

const user1 = new User('User1');
const post1 = new Post(user1, 'My first blog post');
const post2 = new Post(user1, 'My second blog post');

await database.persist(user1, post1, post2);
```

References are not selected in queries by default. See [Database Joins](./query.md#join) for details.

## Many To One

A reference usually has a reverse reference called many-to-one. It is only a virtual reference, since it is not reflected in the database itself. A back reference is annotated `BackReference` and is mainly used for reflection and query joins. If you add a `BackReference` from `User` to `Post`, you can join `Post` directly from `User` queries.

```typescript
@entity.name('user').collection('users')
class User {
    id: number & PrimaryKey & AutoIncrement = 0;
    created: Date = new Date;

    posts?: Post[] & BackReference;

    constructor(public username: string) {
    }
}
```

```typescript
//[ { username: 'User1', posts: [ [Post], [Post] ] } ]
const users = await database.query(User)
    .select('username', 'posts')
    .joinWith('posts')
    .find();
```

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
