# 软删除

软删除插件允许在不实际删除数据库记录的情况下将其隐藏。当一条记录被删除时，它只会被标记为已删除，而不会真正删除。所有查询会自动根据这个已删除属性进行过滤，因此对用户而言就像真的被删除了一样。

要使用该插件，必须实例化 SoftDelete 类并为每个实体启用它。

```typescript
import { entity, PrimaryKey, AutoIncrement } from '@deepkit/type';
import { SoftDelete } from '@deepkit/orm';

@entity.name('user')
class User {
    id: number & PrimaryKey & AutoIncrement = 0;
    created: Date = new Date;

    // 此字段用于标识该记录是否被软删除。
    // 如果已设置，则表示该记录被软删除。
    deletedAt?: Date;

    // 此字段是可选的，可用于追踪是谁/什么删除了该记录。
    deletedBy?: string;

    constructor(
        public name: string
    ) {
    }
}

const softDelete = new SoftDelete(database);
softDelete.enable(User);

//或者再次禁用
softDelete.disable(User);
```

## 删除

要进行软删除，请使用常规方法：在查询中使用 `deleteOne` 或 `deleteMany`，或使用会话删除它们。软删除插件将自动在后台完成其余工作。

## 恢复

已删除的记录可以通过通过 `SoftDeleteQuery` 的“提升”查询进行恢复。它提供 `restoreOne` 和 `restoreMany`。

```typescript
import { SoftDeleteQuery } from '@deepkit/orm';

await database.query(User).lift(SoftDeleteQuery).filter({ id: 1 }).restoreOne();
await database.query(User).lift(SoftDeleteQuery).filter({ id: 1 }).restoreMany();
```

会话也支持恢复实体。

```typescript
import { SoftDeleteSession } from '@deepkit/orm';

const session = database.createSession();
const user1 = session.query(User).findOne();

session.from(SoftDeleteSession).restore(user1);
await session.commit();
```

## 硬删除

要进行硬删除，请通过 SoftDeleteQuery 使用提升查询。这实质上恢复到了未使用软删除插件时的正常行为。

```typescript
import { SoftDeleteQuery } from '@deepkit/orm';

// 真正从数据库中删除该记录
await database.query(User).lift(SoftDeleteQuery).hardDeleteOne();
await database.query(User).lift(SoftDeleteQuery).hardDeleteMany();

// 这些与上面的等价
await database.query(User).lift(SoftDeleteQuery).withSoftDeleted().deleteOne();
await database.query(User).lift(SoftDeleteQuery).withSoftDeleted().deleteMany();
```

## 查询已删除。

通过 `SoftDeleteQuery` 的“提升”查询，你也可以包含已删除的记录。

```typescript
import { SoftDeleteQuery } from '@deepkit/orm';

// 查找所有，包括软删除和未删除的
await database.query(User).lift(SoftDeleteQuery).withSoftDeleted().find();

// 仅查找软删除的
await database.query(s).lift(SoftDeleteQuery).isSoftDeleted().count()
```

## 删除者

可以通过查询和会话设置 `deletedBy`。

```typescript
import { SoftDeleteSession } from '@deepkit/orm';

const session = database.createSession();
const user1 = session.query(User).findOne();

session.from(SoftDeleteSession).setDeletedBy('Peter');
session.remove(user1);

await session.commit();
import { SoftDeleteQuery } from '@deepkit/orm';

database.query(User).lift(SoftDeleteQuery)
.deletedBy('Peter')
.deleteMany();
```