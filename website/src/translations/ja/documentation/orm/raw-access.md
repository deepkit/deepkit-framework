# Raw アクセス

ORM でサポートされていない SQL クエリを実行するなど、データベースに直接アクセスする必要があることはよくあります。これは `Database` Class の `raw` Method を使用して行えます。

```typescript
import { PrimaryKey, AutoIncrement, @entity } from '@deepkit/type';
import { Database } from '@deepkit/orm';
import { sql } from '@deepkit/sql';
import { SqliteDatabaseAdapter } from '@deepkit/sqlite';

@entity.collection('users')
class User {
    id: number & PrimaryKey & AutoIncrement = 0;
    created: Date = new Date;
    constructor(public username: string) {}
}

const database = new Database(new SQLiteDatabaseAdapter(':memory:'), [User]);

const query = 'Pet%';
const rows = await database.raw<User>(sql`SELECT * FROM users WHERE username LIKE ${query}`).find();

const result = await database.raw<{ count: number }>(sql`SELECT count(*) as count FROM users WHERE username LIKE ${query}`).findOne();
console.log('Found', result.count, 'users');
```

SQL クエリは `sql` template string tag を使って構築します。これは値を Parameters として渡せる特別な template string tag です。これらの Parameters は自動的に解析され、安全な prepared statement に変換されます。これは SQLインジェクション攻撃 を避けるために重要です。

カラム名のような動的な identifier を渡すには、`identifier` を使用します:

```typescript
import { identifier, sql } from '@deepkit/sql';

let column = 'username';
const rows = await database.raw<User>(sql`SELECT * FROM users WHERE ${identifier(column)} LIKE ${query}`).find();
```

SQL adapter では、`raw` Method は結果を取得するための `findOne` と `find` Method を備えた `RawQuery` を返します。UPDATE/DELETE など、行を返さない SQL を実行するには、`execute` を使用できます:

```typescript
let username = 'Peter';
await database.raw(sql`UPDATE users SET username = ${username} WHERE id = 1`).execute();
```

また、`RawQuery` は database adapter 用に正しくフォーマットされた最終的な SQL string と parameters を取得することもサポートしています:

```typescript
const query = database.raw(sql`SELECT * FROM users WHERE username LIKE ${query}`);
console.log(query.sql);
console.log(query.params);
```

このようにして、その SQL を別の database client などで実行するために利用できます。

## Types

`raw` には任意の Type を渡すことができ、database からの結果は自動的にその Type に変換されます。これは特に SQL adapter で有用で、Class を渡すと、その Class に自動的に変換されます。

ただし制限があります。この方法では SQL の JOIN はサポートされません。JOIN を使いたい場合は、ORM の query builder を使用する必要があります。

## Mongo

MongoDB adapter は SQL クエリではなく Mongo の Command に基づいているため、少し動作が異なります。

Command には、aggregation pipeline、find クエリ、write Command などがあります。

```typescript
import { MongoDatabaseAdapter } from '@deepkit/mongo';

const database = new Database(MongoDatabaseAdapter('mongodb://localhost:27017/mydatabase'));

// 最初の引数はエントリポイントの collection、2番目は Command の Return Type です
const items = await database.raw<ChatMessage, { count: number }>([
    { $match: { roomId: 'room1' } },
    { $group: { _id: '$userId', count: { $sum: 1 } } },
]).find();
```