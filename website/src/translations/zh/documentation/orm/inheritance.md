# 继承

在 Deepkit ORM 中有多种实现继承的方式。

## 类继承

一种方式是使用类继承，即通过带有 `extends` 的普通类。

```typescript
import { PrimaryKey, AutoIncrement } from '@deepkit/type';

class BaseModel {
    id: number & PrimaryKey & AutoIncrement = 0;
    created: Date = new Date;
    updated: Date = new Date;
}

class User extends BaseModel {
    name: string = '';
}

class Customer extends BaseModel {
    name: string = '';
    address: string = '';
}

new Database(
    new SQLiteDatabaseAdapter('./example.sqlite'),
    [User, Customer]
);
```

由于 `BaseModel` 不会作为实体使用，它不会在数据库中注册。只有 `User` 和 `Customer` 会被注册为实体，并映射到包含 `BaseModel` 所有属性的表。

SQL 表如下所示：

```sql
CREATE TABLE user (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    created TEXT NOT NULL,
    updated TEXT NOT NULL,
    name TEXT NOT NULL
);

CREATE TABLE customer (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    created TEXT NOT NULL,
    updated TEXT NOT NULL,
    name TEXT NOT NULL,
    address TEXT NOT NULL
);
```

## 单表继承

单表继承是一种将多个实体存储在同一张表中的方式。与为每个模型创建独立的表不同，它使用一张表，并通过一个额外的列（通常命名为 type 或类似名称）来标识每条记录的类型。如果你有许多共享相同属性的实体，这种方式非常有用。

```typescript
import { PrimaryKey, AutoIncrement, entity } from '@deepkit/type';

@entity.collection('persons')
abstract class Person {
    id: number & PrimaryKey & AutoIncrement = 0;
    firstName?: string;
    lastName?: string;
    abstract type: string;
}

@entity.singleTableInheritance()
class Employee extends Person {
    email?: string;

    type: 'employee' = 'employee';
}

@entity.singleTableInheritance()
class Freelancer extends Person {
    @t budget: number = 10_000;

    type: 'freelancer' = 'freelancer';
}

new Database(
    new SQLiteDatabaseAdapter('./example.sqlite'), 
    [Employee, Freelancer]
);
```

`Person` 类不是实体，因此不会在数据库中注册。`Employee` 和 `Freelancer` 类是实体，会映射到名为 `persons` 的单个表中。`type` 列用于确定每条记录的类型。

SQL 表如下所示：

```sql
CREATE TABLE persons (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    firstName TEXT,
    lastName TEXT,
    type TEXT NOT NULL,
    email TEXT,
    budget INTEGER
);
``` 

可以看到，budget 被设为可选（尽管在 `Freelance` 类中它是必需的）。这是为了支持将 `Employee`（没有 budget 值）插入到同一张表中。这是单表继承的一个限制。