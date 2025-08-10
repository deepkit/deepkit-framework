# リレーション

リレーションは、2つのエンティティを特定の方法で関連付けることができます。これは通常、データベースでは外部キーの概念を用いて行われます。Deepkit ORM は公式のすべてのデータベースアダプタでリレーションをサポートします。

リレーションは `Reference` デコレータで注釈付けします。通常、リレーションには逆方向のリレーションもあり、これは `BackReference` 型で注釈付けしますが、データベースクエリで逆方向のリレーションを使用する場合にのみ必要です。バックリファレンスは仮想的なものに過ぎません。

## 1対多

参照を保持するエンティティは、通常 `owning side`、または参照を `owns` している側と呼ばれます。次のコードは `User` と `Post` の間の 1対多のリレーションを示します。これは、1人の `User` が複数の `Post` を持てることを意味します。`post` エンティティは `post->user` リレーションを持ちます。データベースには `Post."author"` フィールドが作成され、そこに `User` の主キーが格納されます。

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

参照は、デフォルトではクエリで選択されません。詳細は [データベースの結合](./query.md#join) を参照してください。

## 多対1

参照には通常、多対1と呼ばれる逆参照があります。これはデータベース自体には反映されないため、仮想的な参照に過ぎません。バックリファレンスは `BackReference` で注釈付けされ、主にリフレクションとクエリの結合に使用されます。`User` から `Post` への `BackReference` を追加すると、`User` のクエリから直接 `Post` を結合できます。

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

## 多対多

多対多リレーションでは、多くのレコードを他の多くのレコードに関連付けることができます。たとえば、ユーザーとグループに使用できます。ユーザーは 0 個、1 個、または複数のグループに所属できます。結果として、グループも 0 人、1 人、または複数のユーザーを含むことができます。

多対多のリレーションは通常、ピボットエンティティを使用して実装します。ピボットエンティティは 2 つの他のエンティティへの実際の所有側の参照を保持し、これら 2 つのエンティティはピボットエンティティへのバックリファレンスを持ちます。

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

// ピボットエンティティ
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

これらのエンティティを使って、ユーザーとグループを作成し、ピボットエンティティでそれらを関連付けられます。User にバックリファレンスを使用することで、User のクエリでグループを直接取得できます。

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

ユーザーとグループの関連付けを解除するには、UserGroup レコードを削除します:

```typescript
const users = await database.query(UserGroup)
    .filter({user: user1, group: group1})
    .deleteOne();
```

## 1対1

## 制約

削除/更新時: RESTRICT | CASCADE | SET NULL | NO ACTION | SET DEFAULT