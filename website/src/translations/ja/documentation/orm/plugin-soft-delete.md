# Soft-Delete

Soft-Delete プラグインは、実際に削除せずにデータベースのレコードを非表示のまま保持できます。レコードが削除された場合でも、実際には削除されず、削除済みとしてマークされるだけです。すべての query はこの deleted プロパティを自動でフィルタリングするため、ユーザーには実際に削除されたかのように見えます。

このプラグインを使用するには、SoftDelete Class をインスタンス化し、各 Entity に対して有効化する必要があります。

```typescript
import { entity, PrimaryKey, AutoIncrement } from '@deepkit/type';
import { SoftDelete } from '@deepkit/orm';

@entity.name('user')
class User {
    id: number & PrimaryKey & AutoIncrement = 0;
    created: Date = new Date;

    // このフィールドはレコードがソフト削除されているかどうかの指標として使用されます。
    // 設定されていれば、そのレコードはソフト削除されています。
    deletedAt?: Date;

    // このフィールドは任意で、誰/何がそのレコードを削除したかを追跡するために使用できます。
    deletedBy?: string;

    constructor(
        public name: string
    ) {
    }
}

const softDelete = new SoftDelete(database);
softDelete.enable(User);

// 再度無効化する場合
softDelete.disable(User);
```

## 削除

レコードをソフト削除するには、通常の方法である query の `deleteOne` または `deleteMany` を使用するか、Session を使用して削除します。Soft-Delete プラグインが残りをバックグラウンドで自動的に処理します。

## 復元

削除済みレコードは、`SoftDeleteQuery` による lifted query を使って復元できます。`restoreOne` と `restoreMany` が用意されています。

```typescript
import { SoftDeleteQuery } from '@deepkit/orm';

await database.query(User).lift(SoftDeleteQuery).filter({ id: 1 }).restoreOne();
await database.query(User).lift(SoftDeleteQuery).filter({ id: 1 }).restoreMany();
```

Session でも要素の復元をサポートしています。

```typescript
import { SoftDeleteSession } from '@deepkit/orm';

const session = database.createSession();
const user1 = session.query(User).findOne();

session.from(SoftDeleteSession).restore(user1);
await session.commit();
```

## ハード削除

レコードをハード削除するには、SoftDeleteQuery による lifted query を使用します。これは本質的に、Soft-Delete プラグインを使用しない通常の動作を復元します。

```typescript
import { SoftDeleteQuery } from '@deepkit/orm';

// データベースからレコードを実際に削除する
await database.query(User).lift(SoftDeleteQuery).hardDeleteOne();
await database.query(User).lift(SoftDeleteQuery).hardDeleteMany();

// 上記と同等
await database.query(User).lift(SoftDeleteQuery).withSoftDeleted().deleteOne();
await database.query(User).lift(SoftDeleteQuery).withSoftDeleted().deleteMany();
```

## 削除済みをクエリする

`SoftDeleteQuery` による「lifted」な query では、削除済みレコードも含めることができます。

```typescript
import { SoftDeleteQuery } from '@deepkit/orm';

// すべてを検索（ソフト削除済みと未削除の両方）
await database.query(User).lift(SoftDeleteQuery).withSoftDeleted().find();

// ソフト削除済みのみを検索
await database.query(s).lift(SoftDeleteQuery).isSoftDeleted().count()
```

## Deleted by

`deletedBy` は query と Session から設定できます。

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