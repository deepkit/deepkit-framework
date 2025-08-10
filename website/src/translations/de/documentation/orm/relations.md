# Relationen

Beziehungen ermöglichen es, zwei Entities auf bestimmte Weise zu verbinden. Dies geschieht in Datenbanken üblicherweise mithilfe des Konzepts der Foreign Keys. Deepkit ORM unterstützt Relationen für alle offiziellen Database Adapter.

Eine Relation wird mit dem `Reference` Decorator annotiert. Üblicherweise hat eine Relation auch eine umgekehrte Relation, die mit dem `BackReference` Type annotiert wird, aber nur benötigt wird, wenn die umgekehrte Relation in einer Database Query verwendet werden soll. Back References sind nur virtuell.

## Eins-zu-Viele

Die Entity, die eine Referenz speichert, wird üblicherweise als die `owning side` bzw. diejenige bezeichnet, die die Referenz `owns`. Der folgende Code zeigt zwei Entities mit einer Eins-zu-Viele-Beziehung zwischen `User` und `Post`. Das bedeutet, dass ein `User` mehrere `Post` haben kann. Die `post`-Entity hat die Relation `post->user`. In der Datenbank selbst gibt es nun ein Feld `Post. "author"`, das den Primary Key von `User` enthält.

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

Referenzen werden in Queries standardmäßig nicht ausgewählt. Siehe [Datenbank-Joins](./query.md#join) für Details.

## Viele-zu-Eins

Eine Referenz hat üblicherweise eine umgekehrte Referenz (Viele-zu-Eins). Sie ist nur eine virtuelle Referenz, da sie sich nicht in der Datenbank selbst widerspiegelt. Eine Back Reference wird mit `BackReference` annotiert und wird hauptsächlich für Reflection und Query Joins verwendet. Wenn Sie eine `BackReference` von `User` zu `Post` hinzufügen, können Sie `Post` direkt aus `User`-Queries joinen.

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

## Viele-zu-Viele

Eine Viele-zu-Viele-Beziehung ermöglicht es, viele Datensätze mit vielen anderen zu verknüpfen. Sie kann beispielsweise für Users in Groups verwendet werden. Ein User kann in keiner, einer oder vielen Groups sein. Folglich kann eine Group 0, eine oder viele Users enthalten.

Viele-zu-Viele-Beziehungen werden üblicherweise mithilfe einer Pivot-Entity implementiert. Die Pivot-Entity enthält die tatsächlichen eigenen Referenzen zu zwei anderen Entities, und diese beiden Entities haben Back References zur Pivot-Entity.

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

//die Pivot-Entity
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

Mit diesen Entities können Sie nun Users und Groups erstellen und sie über die Pivot-Entity miteinander verbinden. Durch die Verwendung einer Back Reference in User können wir die Groups direkt mit einer User-Query abrufen.

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

Um die Verknüpfung eines Users mit einer Group aufzuheben, wird der UserGroup-Datensatz gelöscht:

```typescript
const users = await database.query(UserGroup)
    .filter({user: user1, group: group1})
    .deleteOne();
```

## Eins-zu-Eins

## Constraints

Bei Delete/Update: RESTRICT | CASCADE | SET NULL | NO ACTION | SET DEFAULT