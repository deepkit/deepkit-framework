# Soft-Delete

Soft-Delete plugin은 데이터베이스 레코드를 실제로 삭제하지 않고 숨긴 상태로 유지할 수 있게 합니다. 레코드가 삭제되면 실제로 삭제되는 것이 아니라 삭제된 것으로만 표시됩니다. 모든 query는 이 deleted 속성을 자동으로 필터링하므로, 사용자에게는 실제로 삭제된 것처럼 보입니다.

plugin을 사용하려면 SoftDelete class를 인스턴스화하고 각 entity에 대해 활성화해야 합니다.

```typescript
import { entity, PrimaryKey, AutoIncrement } from '@deepkit/type';
import { SoftDelete } from '@deepkit/orm';

@entity.name('user')
class User {
    id: number & PrimaryKey & AutoIncrement = 0;
    created: Date = new Date;

    // 이 필드는 레코드가 soft deleted 상태인지의 표시자로 사용됩니다.
    // 값이 설정되면 해당 레코드는 soft deleted 상태입니다.
    deletedAt?: Date;

    // 이 필드는 선택 사항이며, 누가/무엇이 레코드를 삭제했는지 추적하는 데 사용할 수 있습니다.
    deletedBy?: string;

    constructor(
        public name: string
    ) {
    }
}

const softDelete = new SoftDelete(database);
softDelete.enable(User);

// 또는 다시 비활성화
softDelete.disable(User);
```

## 삭제

레코드를 soft-delete하려면 일반적인 방법을 사용하세요: query에서 `deleteOne` 또는 `deleteMany`를 사용하거나 session을 사용해 삭제하세요. soft-delete plugin이 나머지는 백그라운드에서 자동으로 처리합니다.

## 복원

삭제된 레코드는 `SoftDeleteQuery`를 통해 'lifted' query로 복원할 수 있습니다. `restoreOne`과 `restoreMany`가 있습니다.

```typescript
import { SoftDeleteQuery } from '@deepkit/orm';

await database.query(User).lift(SoftDeleteQuery).filter({ id: 1 }).restoreOne();
await database.query(User).lift(SoftDeleteQuery).filter({ id: 1 }).restoreMany();
```

session 또한 요소 복원을 지원합니다.

```typescript
import { SoftDeleteSession } from '@deepkit/orm';

const session = database.createSession();
const user1 = session.query(User).findOne();

session.from(SoftDeleteSession).restore(user1);
await session.commit();
```

## 하드 삭제

레코드를 하드 삭제하려면 SoftDeleteQuery를 통해 lifted query를 사용하세요. 이는 본질적으로 soft-delete plugin이 사용되지 않는 일반 동작을 복원합니다.

```typescript
import { SoftDeleteQuery } from '@deepkit/orm';

// 데이터베이스에서 레코드를 실제로 삭제
await database.query(User).lift(SoftDeleteQuery).hardDeleteOne();
await database.query(User).lift(SoftDeleteQuery).hardDeleteMany();

// 위와 동일합니다
await database.query(User).lift(SoftDeleteQuery).withSoftDeleted().deleteOne();
await database.query(User).lift(SoftDeleteQuery).withSoftDeleted().deleteMany();
```

## 삭제된 항목 조회.

`SoftDeleteQuery`를 통해 "lifted" query를 사용하면 삭제된 레코드도 포함할 수 있습니다.

```typescript
import { SoftDeleteQuery } from '@deepkit/orm';

// soft deleted와 삭제되지 않은 항목을 포함하여 모두 조회
await database.query(User).lift(SoftDeleteQuery).withSoftDeleted().find();

// soft deleted만 조회
await database.query(s).lift(SoftDeleteQuery).isSoftDeleted().count()
```

## Deleted by

`deletedBy`는 query와 session을 통해 설정할 수 있습니다.

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