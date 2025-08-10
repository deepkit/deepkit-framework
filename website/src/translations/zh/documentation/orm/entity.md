# 实体

实体要么是一个类，要么是一个对象字面量（interface），并且始终有一个主键。
实体使用来自 `@deepkit/type` 的类型注解标注所需的全部信息。例如，定义主键、各种字段及其校验约束。这些字段反映数据库结构，通常对应一张表或一个集合。

通过 `Mapped<'name'>` 之类的特殊类型注解，还可以将字段名映射为数据库中的另一个名称。

## 类

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
}

const database = new Database(new SQLiteDatabaseAdapter(':memory:'), [User]);
await database.migrate();

await database.persist(new User('Peter'));

const allUsers = await database.query(User).find();
console.log('all users', allUsers);
```

## 接口

```typescript
import { PrimaryKey, AutoIncrement, Unique, MinLength, MaxLength } from '@deepkit/type';

interface User {
    id: number & PrimaryKey & AutoIncrement = 0;
    created: Date = new Date;
    firstName?: string;
    lastName?: string;
    username: string & Unique & MinLength<2> & MaxLength<16>;
}

const database = new Database(new SQLiteDatabaseAdapter(':memory:'));
database.register<User>({name: 'user'});

await database.migrate();

const user: User = {id: 0, created: new Date, username: 'Peter'};
await database.persist(user);

const allUsers = await database.query<User>().find();
console.log('all users', allUsers);
```

## 原始类型

诸如 String、Number（bigint）和 Boolean 等原始数据类型会映射到常见的数据库类型。仅使用 TypeScript 的类型即可。

```typescript

interface User {
    logins: number;
    username: string;
    pro: boolean;
}
```

## 主键

每个实体必须且仅有一个主键。不支持多个主键。

主键的基础类型可以是任意类型。常见的是 number 或 UUID。
对于 MongoDB，常用 MongoId 或 ObjectID。

对于数值类型可以使用 `AutoIncrement`。

```typescript
import { PrimaryKey } from '@deepkit/type';

interface User {
    id: number & PrimaryKey;
}
```

## 自增

需要在插入时自动递增的字段使用 `AutoIncrement` 装饰器标注。所有适配器都支持自增值。MongoDB 适配器会使用一个额外的集合来维护计数器。

自增字段是一个自动计数器，只能用于主键。数据库会自动确保 ID 只被使用一次。

```typescript
import { PrimaryKey, AutoIncrement } from '@deepkit/type';

interface User {
    id: number & PrimaryKey & AutoIncrement;
}
```

## UUID

需要为 UUID（v4）类型的字段使用 UUID 装饰器标注。其运行时类型为 `string`，在数据库中多为二进制存储。使用 `uuid()` 函数可创建一个新的 UUID v4。

```typescript
import { uuid, UUID, PrimaryKey } from '@deepkit/type';

class User {
    id: UUID & PrimaryKey = uuid();
}
```

## MongoDB ObjectID

在 MongoDB 中应为 ObjectID 类型的字段需使用 `MongoId` 装饰器标注。其运行时类型为 `string`，在数据库中为 `ObjectId`（二进制）。

MongoID 字段在插入时会自动获得新值。字段名不必是 `_id`，可以使用任意名称。

```typescript
import { PrimaryKey, MongoId } from '@deepkit/type';

class User {
    id: MongoId & PrimaryKey = '';
}
```

## 可选 / 可空

可选字段可通过 TypeScript 的 `title?: string` 或 `title: string | null` 来声明。应只使用其中一种，通常使用可选的 `?` 语法，其在运行时对应 `undefined`。
对于所有 SQL 适配器，这两种写法都会使数据库中的列类型为 `NULLABLE`。因此它们唯一的区别在于运行时表示的值不同。

在下面的示例中，modified 字段是可选的，因此在运行时可以是 undefined，尽管在数据库中始终表示为 NULL。

```typescript
import { PrimaryKey } from '@deepkit/type';

class User {
    id: number & PrimaryKey = 0;
    modified?: Date;
}
```

此示例展示了可空类型的用法。无论在数据库还是在 JavaScript 运行时都使用 NULL。相较于 `modified?: Date` 更为啰嗦，且不常使用。

```typescript
import { PrimaryKey } from '@deepkit/type';

class User {
    id: number & PrimaryKey = 0;
    modified: Date | null = null;
}
```

## 数据库类型映射

|===
|运行时类型|SQLite|MySQL|Postgres|Mongo

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

通过 `DatabaseField` 可以将字段映射为任意数据库类型。该类型必须是有效的 SQL 片段，并会原样传递给迁移系统。

```typescript
import { DatabaseField } from '@deepkit/type';

interface User {
    title: string & DatabaseField<{type: 'VARCHAR(244)'}>;
}
```

若要针对特定数据库映射字段，可使用 `SQLite`、`MySQL` 或 `Postgres`。

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

## 嵌入类型

## 默认值

## 默认表达式

## 复杂类型

## 排除

## 数据库特定列类型