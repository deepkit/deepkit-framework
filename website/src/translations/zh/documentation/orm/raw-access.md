# 原始访问

经常需要直接访问数据库，例如运行 ORM 不支持的 SQL 查询。这可以通过 `Database` 类上的 `raw` 方法完成。

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

SQL 查询是使用 `sql` 模板字符串标签构建的。这是一个特殊的模板字符串标签，允许以参数的形式传递值。这些参数随后会被自动解析并转换为安全的预处理语句。这对于避免 SQL 注入攻击非常重要。

要传递列名等动态标识符，可以使用 `identifier`：

```typescript
import { identifier, sql } from '@deepkit/sql';

let column = 'username';
const rows = await database.raw<User>(sql`SELECT * FROM users WHERE ${identifier(column)} LIKE ${query}`).find();
```

对于 SQL 适配器，`raw` 方法会返回一个带有 `findOne` 和 `find` 方法以获取结果的 `RawQuery`。要执行不返回行（如 UPDATE/DELETE/等）的 SQL，可使用 `execute`：

```typescript
let username = 'Peter';
await database.raw(sql`UPDATE users SET username = ${username} WHERE id = 1`).execute();
```

`RawQuery` 还支持获取最终的 SQL 字符串和参数，并为数据库适配器正确格式化：

```typescript
const query = database.raw(sql`SELECT * FROM users WHERE username LIKE ${query}`);
console.log(query.sql);
console.log(query.params);
```

这样，SQL 也可以在其他数据库客户端中执行，例如。

## 类型

请注意，你可以向 `raw` 传递任意类型，数据库返回的结果会被自动转换为该类型。这对 SQL 适配器尤其有用，你可以传递一个类，返回结果会自动转换为该类的实例。

但这也有局限性。以这种方式不支持 SQL JOIN。如果你想使用 JOIN，必须使用 ORM 的查询构建器。

## Mongo

MongoDB 适配器的工作方式稍有不同，因为它不是基于 SQL 查询，而是基于 Mongo 命令。

命令可以是聚合管道、查找查询或写入命令。

```typescript
import { MongoDatabaseAdapter } from '@deepkit/mongo';

const database = new Database(MongoDatabaseAdapter('mongodb://localhost:27017/mydatabase'));

// 第一个参数是入口集合，第二个是命令的返回类型
const items = await database.raw<ChatMessage, { count: number }>([
    { $match: { roomId: 'room1' } },
    { $group: { _id: '$userId', count: { $sum: 1 } } },
]).find();
```