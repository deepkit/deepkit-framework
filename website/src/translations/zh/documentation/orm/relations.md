# 关系

关系允许以某种方式将两个实体连接起来。这通常在数据库中通过外键的概念来实现。Deepkit ORM 在所有官方数据库适配器中都支持关系。

关系使用 `Reference` 装饰器进行标注。通常一个关系还会有一个反向关系，用 `BackReference` 类型标注，但只有在需要在数据库查询中使用反向关系时才需要。反向引用仅为虚拟的。

## 一对多

存储引用的实体通常称为 `owning side`，即 `owns` 该引用的一方。下面的代码展示了 `User` 与 `Post` 之间的一对多关系的两个实体。这意味着一个 `User` 可以拥有多个 `Post`。实体 `post` 拥有 `post->user` 关联。在数据库中，此时会有一个字段 `Post. "author"`，其中包含 `User` 的主键。

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

默认情况下，查询不会选取引用。详见[数据库联接](./query.md#join)。

## 多对一

一个引用通常会有一个反向引用（多对一）。它只是一个虚拟引用，因为它并不会在数据库中体现。反向引用使用 `BackReference` 标注，主要用于反射与查询联接。如果在 `User` 上添加到 `Post` 的 `BackReference`，就可以在 `User` 的查询中直接联接 `Post`。

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

## 多对多

多对多关系允许将多个记录与多个其他记录关联起来。例如，它可用于用户与组的场景。一个用户可以不在任何组、在一个组或多个组中。相应地，一个组可以包含 0 个、一个或多个用户。

多对多关系通常使用一个中间表实体来实现。该中间实体包含指向另外两个实体的实际拥有端引用，而这两个实体则对该中间实体设置反向引用。

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

// 中间表实体
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

使用这些实体后，你可以创建用户与组，并通过中间实体将它们关联起来。通过在 User 中使用反向引用，我们可以在 User 的查询中直接获取其 groups。

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

要将用户与组解除关联，删除对应的 UserGroup 记录即可：

```typescript
const users = await database.query(UserGroup)
    .filter({user: user1, group: group1})
    .deleteOne();
```

## 一对一

## 约束

删除/更新时：RESTRICT | CASCADE | SET NULL | NO ACTION | SET DEFAULT