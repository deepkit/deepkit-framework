# 事务

事务是按顺序执行的一组语句、查询或操作（如 select、insert、update 或 delete），它们作为单个工作单元执行，可以提交或回滚。

Deepkit 为所有官方支持的数据库提供事务支持。默认情况下，任何查询或数据库会话都不使用事务。要启用事务，有两种主要方法：会话和回调。

## 会话事务

你可以为每个创建的会话启动并分配一个新事务。这是与数据库交互的首选方式，因为你可以轻松传递 Session 对象，并且由该会话实例化的所有查询都会自动归入其事务。

一种典型的模式是将所有操作包裹在 try-catch 块中，并在最后一行执行 `commit()`（仅当之前的所有命令都成功时才会执行），在 catch 块中执行 `rollback()`，以便一旦发生错误就回滚所有更改。

尽管存在替代的 API（见下文），但所有事务仅适用于数据库会话对象。要将数据库会话中工作单元的未提交更改持久化到数据库，通常调用 `commit()`。在事务性会话中，`commit()` 不仅会将所有待处理更改提交到数据库，还会完成（“提交”）事务，从而关闭该事务。或者，你可以调用 `session.flush()` 在不调用 `commit` 的情况下提交所有待处理更改，从而不会关闭事务。若要在不刷新工作单元的情况下提交事务，请使用 `session.commitTransaction()`。

```typescript
const session = database.createSession();

// 这会分配一个新事务，并在下一次数据库操作时启动它。
session.useTransaction();

try {
    // 该查询在事务中执行
    const users = await session.query(User).find();

    await moreDatabaseOperations(session);

    await session.commit();
} catch (error) {
    await session.rollback();
}
```

一旦 `commit()` 或 `rollback()` 在会话中执行，该事务就会被释放。如果你想在新事务中继续，就必须再次调用 `useTransaction()`。

请注意，一旦在事务性会话中执行了第一条数据库操作，分配的数据库连接将固定并独占于当前会话对象（粘性）。因此，所有后续操作都会在同一连接上执行（从而在大多数数据库中，也是在同一数据库服务器上）。只有当事务性会话终止（commit 或 rollback）时，数据库连接才会被再次释放。因此，建议尽可能缩短事务的持续时间。

如果一个会话已经连接到某个事务，调用 `session.useTransaction()` 将始终返回同一对象。使用 `session.isTransaction()` 来检查会话是否关联了事务。

不支持嵌套事务。

## 事务回调

事务性会话的另一种替代方式是 `database.transaction(callback)`。

```typescript
await database.transaction(async (session) => {
    // 该查询在事务中执行
    const users = await session.query(User).find();

    await moreDatabaseOperations(session);
});
```

`database.transaction(callback)` 方法会在一个新的事务性会话中执行异步回调。若回调成功（即未抛出错误），该会话会自动提交（其事务被提交，且所有更改被刷新）。若回调失败，会话会自动执行 `rollback()`，并将错误向外传播。

## 隔离级别

许多数据库支持不同类型的事务。要更改事务行为，你可以对 `useTransaction()` 返回的事务对象调用不同的方法。该事务对象的接口取决于所使用的数据库适配器。例如，来自 MySQL 数据库的事务对象与来自 MongoDB 的事务对象具有不同的选项。使用代码补全或查看数据库适配器的接口以获取可用选项列表。

```typescript
const database = new Database(new MySQLDatabaseAdapter());

const session = database.createSession();
session.useTransaction().readUncommitted();

try {
    //...操作
    await session.commit();
} catch (error) {
    await session.rollback();
}

// 或者
await database.transaction(async (session) => {
    // 只要尚未执行任何数据库操作，这是可行的。
    session.useTransaction().readUncommitted();

    //...操作
});
```

虽然 MySQL、PostgreSQL 和 SQLite 的事务默认即可使用，但对 MongoDB，你必须先将其设置为“副本集”。

要将标准的 MongoDB 实例转换为副本集，请参阅官方文档链接：
[将独立部署转换为副本集](https://docs.mongodb.com/manual/tutorial/convert-standalone-to-replica-set).