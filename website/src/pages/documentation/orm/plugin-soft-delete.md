# Soft-Delete

The Soft-Delete plugin allows to keep database records hidden without actually deleting them. When a record is deleted, it is only marked as deleted and not actually deleted. All queries automatically filter for this deleted property, so it feels to the user as if it is actually deleted.

To use the plugin, you must instantiate the SoftDelete class and enable it for each entity.

```typescript
import { entity, PrimaryKey, AutoIncrement } from '@deepkit/type';
import { SoftDelete } from '@deepkit/orm';

@entity.name('user')
class User {
    id: number & PrimaryKey & AutoIncrement = 0;
    created: Date = new Date;

    // this field is used as indicator whether the record is soft deleted.
    // if it is set, the record is soft deleted.
    deletedAt?: Date;

    // this field is optional and can be used to track who/what deleted the record.
    deletedBy?: string;

    constructor(
        public name: string
    ) {
    }
}

const softDelete = new SoftDelete(database);
softDelete.enable(User);

//or disable again
softDelete.disable(User);
```

## Delete

To soft-delete records, use the usual methods: `deleteOne` or `deleteMany` in a query, or use the session to delete them. The soft-delete plugin will do the rest automatically in the background.

## Restore

Deleted records can be restored using a lifted query via `SoftDeleteQuery`. It has `restoreOne` and `restoreMany`.

```typescript
import { SoftDeleteQuery } from '@deepkit/orm';

await database.query(User).lift(SoftDeleteQuery).filter({ id: 1 }).restoreOne();
await database.query(User).lift(SoftDeleteQuery).filter({ id: 1 }).restoreMany();
```

The session also supports element recovery.

```typescript
import { SoftDeleteSession } from '@deepkit/orm';

const session = database.createSession();
const user1 = session.query(User).findOne();

session.from(SoftDeleteSession).restore(user1);
await session.commit();
```

## Hard Delete

To hard delete records, use a lifted query via SoftDeleteQuery. This essentially restores the normal behavior where no soft-delete plugin is used.

```typescript
import { SoftDeleteQuery } from '@deepkit/orm';

// really delete the record from the database
await database.query(User).lift(SoftDeleteQuery).hardDeleteOne();
await database.query(User).lift(SoftDeleteQuery).hardDeleteMany();

//those are equal to the one above
await database.query(User).lift(SoftDeleteQuery).withSoftDeleted().deleteOne();
await database.query(User).lift(SoftDeleteQuery).withSoftDeleted().deleteMany();
```

## Query deleted.

With a "lifted" query via `SoftDeleteQuery` you can also include deleted records.

```typescript
import { SoftDeleteQuery } from '@deepkit/orm';

// find all, soft deleted and not deleted
await database.query(User).lift(SoftDeleteQuery).withSoftDeleted().find();

// find only soft deleted
await database.query(s).lift(SoftDeleteQuery).isSoftDeleted().count()
```

## Deleted by

`deletedBy` can be set via query and sessions.

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
