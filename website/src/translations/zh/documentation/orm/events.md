# 事件

事件是一种接入 Deepkit ORM 的方式，允许你编写强大的插件。事件分为两类：查询事件和工作单元事件。插件作者通常会同时使用这两类事件，以支持这两种操作数据的方式。

事件通过 `Database.listen` 在某个事件令牌上注册。也可以在会话上注册短生命周期的事件监听器。

```typescript
import { Query, Database } from '@deepkit/orm';

const database = new Database(...);
database.listen(Query.onFetch, async (event) => {
});

const session = database.createSession();

//只会在此特定会话中执行
session.eventDispatcher.listen(Query.onFetch, async (event) => {
});
```

## 查询事件

当通过 `Database.query()` 或 `Session.query()` 执行查询时会触发查询事件。

每个事件都有其附加属性，例如实体类型、查询本身以及数据库会话。你可以通过给 `Event.query` 赋予新的查询来覆盖原始查询。

```typescript
import { Query, Database } from '@deepkit/orm';

const database = new Database(...);

const unsubscribe = database.listen(Query.onFetch, async event => {
    //覆盖用户的查询，以便执行其他内容。
    event.query = event.query.filterField('fieldName', 123);
});

//删除该钩子，调用 unsubscribe
unsubscribe();
```

“Query” 有多个事件令牌：

| 事件令牌              | 描述                                                       |
|-----------------------|------------------------------------------------------------|
| Query.onFetch         | 当通过 find()/findOne()/等 获取对象时                      |
| Query.onDeletePre     | 在通过 deleteMany/deleteOne() 删除对象之前                 |
| Query.onDeletePost    | 在通过 deleteMany/deleteOne() 删除对象之后                 |
| Query.onPatchPre      | 在通过 patchMany/patchOne() 修补/更新对象之前              |
| Query.onPatchPost     | 在通过 patchMany/patchOne() 修补/更新对象之后              |

## 工作单元事件

当新会话提交更改时会触发工作单元事件。

| 事件令牌                     | 描述                                                                                      |
|-----------------------------|-------------------------------------------------------------------------------------------|
| DatabaseSession.onUpdatePre  | 在 `DatabaseSession` 对象对数据库记录发起更新操作之前触发。                                |
| DatabaseSession.onUpdatePost | 在 `DatabaseSession` 对象成功完成更新操作之后立即触发。                                    |
| DatabaseSession.onInsertPre  | 在 `DatabaseSession` 对象开始向数据库插入新记录之前触发。                                   |
| DatabaseSession.onInsertPost | 在 `DatabaseSession` 对象成功插入新记录之后立即触发。                                       |
| DatabaseSession.onDeletePre  | 在 `DatabaseSession` 对象开始执行删除操作以移除数据库记录之前触发。                         |
| DatabaseSession.onDeletePost | 在 `DatabaseSession` 对象完成删除操作之后立即触发。                                         |
| DatabaseSession.onCommitPre  | 在 `DatabaseSession` 对象将会话期间的任何更改提交到数据库之前触发。                         |