# 관계

관계는 두 엔티티를 특정 방식으로 연결할 수 있게 해줍니다. 이는 보통 데이터베이스에서 외래 키(foreign key) 개념을 사용해 수행됩니다. Deepkit ORM은 모든 공식 데이터베이스 어댑터에서 관계를 지원합니다.

관계는 `Reference` 데코레이터로 주석 처리됩니다. 일반적으로 관계에는 반대 방향의 관계도 있는데, 이는 `BackReference` 타입으로 주석 처리되며, 데이터베이스 쿼리에서 역방향 관계를 사용하려는 경우에만 필요합니다. Back reference는 오직 가상입니다.

## 일대다

참조를 저장하는 엔티티는 보통 `owning side` 또는 참조를 `owns`하는 쪽이라고 부릅니다. 다음 코드는 `User`와 `Post` 사이의 일대다 관계를 가진 두 엔티티를 보여줍니다. 이는 하나의 `User`가 여러 개의 `Post`를 가질 수 있음을 의미합니다. `post` 엔티티에는 `post->user` 관계가 있습니다. 데이터베이스 자체에는 이제 `User`의 기본 키를 담고 있는 `Post."author"` 필드가 생깁니다.

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

기본적으로 쿼리에서 Reference는 자동으로 선택되지 않습니다. 자세한 내용은 [데이터베이스 Join](./query.md#join)을 참고하세요.

## 다대일

참조에는 일반적으로 다대일이라고 불리는 역참조가 있습니다. 이는 데이터베이스 자체에 반영되지 않기 때문에 오직 가상 참조입니다. Back reference는 `BackReference`로 주석 처리되며, 주로 리플렉션과 쿼리 join에 사용됩니다. `User`에서 `Post`로 `BackReference`를 추가하면, `User` 쿼리에서 직접 `Post`를 join할 수 있습니다.

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

## 다대다

다대다 관계는 많은 레코드를 다른 많은 레코드와 연결할 수 있게 해줍니다. 예를 들어, 그룹에 속한 사용자에 사용할 수 있습니다. 한 사용자는 0개, 1개 또는 여러 개의 그룹에 있을 수 있습니다. 따라서 한 그룹은 0명, 1명 또는 여러 명의 사용자를 포함할 수 있습니다.

다대다 관계는 보통 피벗 엔티티를 사용하여 구현합니다. 피벗 엔티티는 두 다른 엔티티에 대한 실제 own reference들을 포함하고, 이 두 엔티티는 피벗 엔티티에 대한 back reference를 가집니다.

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

// 피벗 엔티티
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

이 엔티티들을 사용하여 이제 사용자와 그룹을 생성하고 피벗 엔티티로 연결할 수 있습니다. User에 back reference를 사용함으로써, User 쿼리로 그룹들을 직접 조회할 수 있습니다.

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

사용자를 그룹에서 분리(unlink)하려면, 해당 UserGroup 레코드를 삭제합니다:

```typescript
const users = await database.query(UserGroup)
    .filter({user: user1, group: group1})
    .deleteOne();
```

## 일대일

## 제약 조건

삭제/업데이트 시: RESTRICT | CASCADE | SET NULL | NO ACTION | SET DEFAULT