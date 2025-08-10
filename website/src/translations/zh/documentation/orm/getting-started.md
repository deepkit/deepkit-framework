# 快速开始

Deepkit 提供了一个数据库 ORM，使得可以以现代的方式访问数据库。
实体可以用 TypeScript 类型简单地定义：

```typescript
import { entity, PrimaryKey, AutoIncrement, 
    Unique, MinLength, MaxLength } from '@deepkit/type';

type Username = string & Unique & MinLength<2> & MaxLength<16>;

// 类实体
@entity.name('user')
class User {
    id: number & PrimaryKey & AutoIncrement = 0;
    created: Date = new Date;
    firstName?: string;
    lastName?: string;

    constructor(
        public username: Username,
        public email: string & Unique,
    ) {}
}

// 或作为 interface
interface User {
    id: number & PrimaryKey & AutoIncrement;
    created: Date;
    firstName?: string;
    lastName?: string;
    username: Username;
    email: string & Unique;
}
```

可以使用任何 TypeScript 类型以及 Deepkit 的验证装饰器来完整定义实体。
实体类型系统的设计使得这些类型或类也可以用于 HTTP 路由、RPC 操作或前端等其他领域。例如，这可以防止在整个应用中多处重复定义同一个用户。

## 安装

由于 Deepkit ORM 基于运行时类型，因此必须确保已正确安装 `@deepkit/type`。
参见[运行时类型安装](../runtime-types/getting-started.md)。

如果这一步已成功，则可以安装 `@deepkit/orm` 本体以及一个数据库适配器。

如果要使用类作为实体，必须在 tsconfig.json 中启用 `experimentalDecorators`：

```json
{
  "compilerOptions": {
    "experimentalDecorators": true
  }
}
```

安装库之后，安装一个数据库适配器即可直接使用其 API。

### SQLite

```sh
npm install @deepkit/orm @deepkit/sqlite
```

```typescript
import { SQLiteDatabaseAdapter } from '@deepkit/sqlite';

const database = new Database(new SQLiteDatabaseAdapter('./example.sqlite'), [User]);
const database = new Database(new SQLiteDatabaseAdapter(':memory:'), [User]);
```

### MySQL

```sh
npm install @deepkit/orm @deepkit/mysql
```

```typescript
import { MySQLDatabaseAdapter } from '@deepkit/mysql';

const database = new Database(new MySQLDatabaseAdapter({
    host: 'localhost',
    port: 3306
}), [User]);
```

### Postgres

```sh
npm install @deepkit/orm @deepkit/postgres
```

```typescript
import { PostgresDatabaseAdapter } from '@deepkit/postgres';

const database = new Database(new PostgresDatabaseAdapter({
    host: 'localhost',
    port: 3306
}), [User]);
```

### MongoDB

```sh
npm install @deepkit/orm @deepkit/bson @deepkit/mongo
```

```typescript
import { MongoDatabaseAdapter } from '@deepkit/mongo';

const database = new Database(new MongoDatabaseAdapter('mongodb://localhost/mydatabase'), [User]);
```

## 用法

主要使用 `Database` 对象。实例化后，它可以在整个应用中用于查询或操作数据。到数据库的连接是延迟初始化的。

`Database` 对象需要传入一个适配器，该适配器来自相应的数据库适配器库。

```typescript
import { SQLiteDatabaseAdapter } from '@deepkit/sqlite';
import { entity, PrimaryKey, AutoIncrement } from '@deepkit/type';
import { Database } from '@deepkit/orm';

async function main() {
    @entity.name('user')
    class User {
        public id: number & PrimaryKey & AutoIncrement = 0;
        created: Date = new Date;

        constructor(public name: string) {
        }
    }

    const database = new Database(new SQLiteDatabaseAdapter('./example.sqlite'), [User]);
    await database.migrate(); // 创建表

    await database.persist(new User('Peter'));

    const allUsers = await database.query(User).find();
    console.log('all users', allUsers);
}

main();
```

### 数据库

### 连接

#### 只读副本

## 仓储

## 索引

## 大小写敏感性

## 字符集

## 排序规则

## 批处理

## 缓存

## 多租户

## 命名策略

## 锁定

### 乐观锁

### 悲观锁

## 自定义类型

## 日志

## 迁移

## 数据填充

## 原生数据库访问

### SQL

### MongoDB

## 插件