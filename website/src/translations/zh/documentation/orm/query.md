# 查询

查询是一个对象，用于描述如何从数据库检索或修改数据。它有多种方法来描述查询，以及执行它们的终止方法。数据库适配器可以通过多种方式扩展查询 API，以支持数据库特定的功能。

你可以使用 `Database.query(T)` 或 `Session.query(T)` 创建查询。我们建议使用 Session，因为它能提升性能。

```typescript
@entity.name('user')
class User {
    id: number & PrimaryKey & AutoIncrement = 0;
    created: Date = new Date;
    birthdate?: Date;
    visits: number = 0;

    constructor(public username: string) {
    }
}

const database = new Database(...);

//[ { username: 'User1' }, { username: 'User2' }, { username: 'User2' } ]
const users = await database.query(User).select('username').find();
```

## 过滤器

可以应用过滤器来限制结果集。

```typescript
// 简单过滤器
const users = await database.query(User).filter({name: 'User1'}).find();

// 多个过滤器，全部 AND
const users = await database.query(User).filter({name: 'User1', id: 2}).find();

// 范围过滤：$gt, $lt, $gte, $lte（大于，小于，...）
// 等价于 WHERE created < NOW()
const users = await database.query(User).filter({created: {$lt: new Date}}).find();
// 等价于 WHERE id > 500
const users = await database.query(User).filter({id: {$gt: 500}}).find();
// 等价于 WHERE id >= 500
const users = await database.query(User).filter({id: {$gte: 500}}).find();

// 集合过滤：$in, $nin（在，不在）
// 等价于 WHERE id IN (1, 2, 3)
const users = await database.query(User).filter({id: {$in: [1, 2, 3]}}).find();

// 正则过滤
const users = await database.query(User).filter({username: {$regex: /User[0-9]+/}}).find();

// 分组：$and, $nor, $or
// 等价于 WHERE (username = 'User1') OR (username = 'User2')
const users = await database.query(User).filter({
    $or: [{username: 'User1'}, {username: 'User2'}]
}).find();


// 嵌套分组
// 等价于 WHERE username = 'User1' OR (username = 'User2' and id > 0)
const users = await database.query(User).filter({
    $or: [{username: 'User1'}, {username: 'User2', id: {$gt: 0}}]
}).find();


// 嵌套分组
// 等价于 WHERE username = 'User1' AND (created < NOW() OR id > 0)
const users = await database.query(User).filter({
    $and: [{username: 'User1'}, {$or: [{created: {$lt: new Date}, id: {$gt: 0}}]}]
}).find();
```

### 等于

### 大于 / 小于

### 正则表达式

### 分组 AND/OR

### In

## 选择字段

要缩小从数据库接收的字段范围，可以使用 `select('field1')`。

```typescript
const user = await database.query(User).select('username').findOne();
const user = await database.query(User).select('id', 'username').findOne();
```

需要注意的是，一旦使用 `select` 缩小了字段范围，结果将不再是实体的实例，而只是普通对象字面量。

```
const user = await database.query(User).select('username').findOne();
user instanceof User; //false
```

## 排序

使用 `orderBy(field, order)` 可以改变条目的顺序。
可以多次调用 `orderBy` 以进一步细化排序。

```typescript
const users = await session.query(User).orderBy('created', 'desc').find();
const users = await session.query(User).orderBy('created', 'asc').find();
```

## 分页

可以使用 `itemsPerPage()` 和 `page()` 方法对结果进行分页。页码从 1 开始。

```typescript
const users = await session.query(User).itemsPerPage(50).page(1).find();
```

通过备用方法 `limit` 和 `skip` 也可以手动分页。

```typescript
const users = await session.query(User).limit(5).skip(10).find();
```

[#database-join]
## 连接（Join）

默认情况下，实体中的引用既不会包含在查询中也不会被加载。若要在查询中包含连接但不加载引用，请使用 `join()`（左连接）或 `innerJoin()`。若要在查询中包含连接并加载引用，请使用 `joinWith()` 或 `innerJoinWith()`。

以下所有示例都假设这些模型模式：

```typescript
@entity.name('group')
class Group {
    id: number & PrimaryKey & AutoIncrement = 0;
    created: Date = new Date;

    constructor(public username: string) {
    }
}

@entity.name('user')
class User {
    id: number & PrimaryKey & AutoIncrement = 0;
    created: Date = new Date;

    group?: Group & Reference;

    constructor(public username: string) {
    }
}
```

```typescript
// 只选择有分配到组的用户（INNER JOIN）
const users = await session.query(User).innerJoin('group').find();
for (const user of users) {
    user.group; // 报错，因为引用未被加载
}
```

```typescript
// 只选择有分配到组的用户（INNER JOIN）并加载关系
const users = await session.query(User).innerJoinWith('group').find();
for (const user of users) {
    user.group.name; // 可用
}
```

要修改连接查询，请使用相同的方法，但加上 `use` 前缀：`useJoin`、`useInnerJoin`、`useJoinWith` 或 `useInnerJoinWith`。要结束连接查询的修改，使用 `end()` 回到父查询。

```typescript
// 只选择分配了名为 'admins' 的组的用户（INNER JOIN）
const users = await session.query(User)
    .useInnerJoinWith('group')
        .filter({name: 'admins'})
        .end()  // 返回到父查询
    .find();

for (const user of users) {
    user.group.name; // 始终为 admin
}
```

## 聚合

聚合方法允许你统计记录并聚合字段。

以下示例假设此模型模式：

```typescript
@entity.name('file')
class File {
    id: number & PrimaryKey & AutoIncrement = 0;
    created: Date = new Date;

    downloads: number = 0;

    category: string = 'none';

    constructor(public path: string & Index) {
    }
}
```

`groupBy` 允许按指定字段对结果分组。

```typescript
await database.persist(
    cast<File>({path: 'file1', category: 'images'}),
    cast<File>({path: 'file2', category: 'images'}),
    cast<File>({path: 'file3', category: 'pdfs'})
);

//[ { category: 'images' }, { category: 'pdfs' } ]
await session.query(File).groupBy('category').find();
```

有多种聚合方法：`withSum`、`withAverage`、`withCount`、`withMin`、`withMax`、`withGroupConcat`。每个方法都需要字段名作为第一个参数，并可选地提供第二个参数以更改别名。

```typescript
// 首先我们更新部分记录：
await database.query(File).filter({path: 'images/file1'}).patchOne({$inc: {downloads: 15}});
await database.query(File).filter({path: 'images/file2'}).patchOne({$inc: {downloads: 5}});

//[{ category: 'images', downloads: 20 },{ category: 'pdfs', downloads: 0 }]
await session.query(File).groupBy('category').withSum('downloads').find();

//[{ category: 'images', downloads: 10 },{ category: 'pdfs', downloads: 0 }]
await session.query(File).groupBy('category').withAverage('downloads').find();

//[ { category: 'images', amount: 2 }, { category: 'pdfs', amount: 1 } ]
await session.query(File).groupBy('category').withCount('id', 'amount').find();
```

## 返回（Returning）

使用 `returning` 可以在通过 `patch` 和 `delete` 更改数据时额外请求字段。

注意：并非所有数据库适配器都会以原子方式返回字段。请使用事务以确保数据一致性。

```typescript
await database.query(User).patchMany({visits: 0});

//{ modified: 1, returning: { visits: [ 5 ] }, primaryKeys: [ 1 ] }
const result = await database.query(User)
    .filter({username: 'User1'})
    .returning('username', 'visits')
    .patchOne({$inc: {visits: 5}});
```

## Find

返回匹配指定过滤器的条目数组。

```typescript
const users: User[] = await database.query(User).filter({username: 'Peter'}).find();
```

## FindOne

返回匹配指定过滤器的条目。
如果未找到条目，将抛出 `ItemNotFound` 错误。

```typescript
const users: User = await database.query(User).filter({username: 'Peter'}).findOne();
```

## FindOneOrUndefined

返回匹配指定过滤器的条目。
如果未找到条目，则返回 undefined。

```typescript
const query = database.query(User).filter({username: 'Peter'});
const users: User|undefined = await query.findOneOrUndefined();
```

## FindField

返回匹配指定过滤器的某个字段的列表。

```typescript
const usernames: string[] = await database.query(User).findField('username');
```

## FindOneField

返回匹配指定过滤器的某个字段的值。
如果未找到条目，将抛出 `ItemNotFound` 错误。

```typescript
const username: string = await database.query(User).filter({id: 3}).findOneField('username');
```

## Patch

Patch 是一种更改查询，用于修改查询所描述的记录。方法
`patchOne` 和 `patchMany` 会结束查询并执行补丁操作。

`patchMany` 会更改数据库中符合指定过滤器的所有记录。如果未设置过滤器，整个表都会被更改。使用 `patchOne` 可一次仅更改一个条目。

```typescript
await database.query(User).filter({username: 'Peter'}).patch({username: 'Peter2'});

await database.query(User).filter({username: 'User1'}).patchOne({birthdate: new Date});
await database.query(User).filter({username: 'User1'}).patchOne({$inc: {visits: 1}});

await database.query(User).patchMany({visits: 0});
```

## 删除

`deleteMany` 会删除数据库中所有匹配指定过滤器的条目。
如果未设置过滤器，整个表都会被删除。使用 `deleteOne` 可一次仅删除一个条目。

```typescript
const result = await database.query(User)
    .filter({visits: 0})
    .deleteMany();

const result = await database.query(User).filter({id: 4}).deleteOne();
```

## Has

返回数据库中是否至少存在一个条目。

```typescript
const userExists: boolean = await database.query(User).filter({username: 'Peter'}).has();
```

## 计数

返回条目数量。

```typescript
const userCount: number = await database.query(User).count();
```

## 提升（Lift）

对查询进行“提升”意味着向其添加新功能。这通常由插件或复杂架构使用，以将较大的查询类拆分为多个方便、可复用的类。

```typescript
import { FilterQuery, Query } from '@deepkit/orm';

class UserQuery<T extends {birthdate?: Date}> extends Query<T>  {
    hasBirthday() {
        const start = new Date();
        start.setHours(0,0,0,0);
        const end = new Date();
        end.setHours(23,59,59,999);

        return this.filter({$and: [{birthdate: {$gte: start}}, {birthdate: {$lte: end}}]} as FilterQuery<T>);
    }
}

await session.query(User).lift(UserQuery).hasBirthday().find();
```