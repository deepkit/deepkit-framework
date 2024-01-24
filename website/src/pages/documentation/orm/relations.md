# Relations

Relationships allow you to connect two entities in a certain way. This is usually done in databases using the concept of foreign keys. Deepkit ORM supports relations for all official database adapters.

A relation is annotated with the `Reference` decorator. Usually a relation also has a reverse relation, which is annotated with the `BackReference` type, but is only needed if the reverse relation is to be used in a database query. Back references are only virtual.

## One To Many

The entity that stores a reference is usually referred to as the `owning side` or the one that `owns` the reference. The following code shows two entities with a one-to-many relationship between `User` and `Post`. This means that one `User` can have multiple `Post`. The `post` entity has the `post->user` relationship. In the database itself there is now a field `Post. "author"` that contains the primary key of `User`.

```typescript
import { Database } from '@deepkit/orm';
import { SQLiteDatabaseAdapter } from '@deepkit/sqlite';
import { AutoIncrement, PrimaryKey, Reference, entity } from '@deepkit/type';

@entity.collection('users')
class User {
  id: number & PrimaryKey & AutoIncrement = 0;
  created: Date = new Date();

  constructor(public username: string) {}
}

@entity.collection('posts')
class Post {
  id: number & PrimaryKey & AutoIncrement = 0;
  created: Date = new Date();

  constructor(
    public author: User & Reference,
    public title: string,
  ) {}
}

const database = new Database(new SQLiteDatabaseAdapter(':memory:'), [User, Post]);
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
  created: Date = new Date();

  posts?: Post[] & BackReference;

  constructor(public username: string) {}
}
```

```typescript
//[ { username: 'User1', posts: [ [Post], [Post] ] } ]
const users = await database.query(User).select('username', 'posts').joinWith('posts').find();
```

## Many To Many

A many-to-many relationship allows you to associate many records with many others. For example, it can be used for users in groups. A user can be in none, one or many groups. Consequently, a group can contain 0, one or many users.

Many-to-many relationships are usually implemented using a pivot entity. The pivot entity contains the actual own references to two other entities, and these two entities have back references to the pivot entity.

```typescript
@entity.name('user')
class User {
  id: number & PrimaryKey & AutoIncrement = 0;
  created: Date = new Date();

  groups?: Group[] & BackReference<{ via: typeof UserGroup }>;

  constructor(public username: string) {}
}

@entity.name('group')
class Group {
  id: number & PrimaryKey & AutoIncrement = 0;

  users?: User[] & BackReference<{ via: typeof UserGroup }>;

  constructor(public name: string) {}
}

//the pivot entity
@entity.name('userGroup')
class UserGroup {
  id: number & PrimaryKey & AutoIncrement = 0;

  constructor(
    public user: User & Reference,
    public group: Group & Reference,
  ) {}
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
const users = await database.query(User).select('username', 'groups').joinWith('groups').find();
```

To unlink a user from a group, the UserGroup record is deleted:

```typescript
const users = await database.query(UserGroup).filter({ user: user1, group: group1 }).deleteOne();
```

## One To One

## Constraints

On Delete/Update: RESTRICT | CASCADE | SET NULL | NO ACTION | SET DEFAULT
