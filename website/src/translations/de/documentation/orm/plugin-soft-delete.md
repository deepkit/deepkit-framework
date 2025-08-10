# Soft-Delete

Das Soft-Delete-Plugin ermöglicht es, Datenbankeinträge verborgen zu halten, ohne sie tatsächlich zu löschen. Wenn ein Eintrag gelöscht wird, wird er nur als gelöscht markiert und nicht wirklich entfernt. Alle Abfragen filtern diese deleted-Property automatisch, sodass es sich für den Benutzer so anfühlt, als wäre er tatsächlich gelöscht.

Um das Plugin zu verwenden, müssen Sie die SoftDelete Class instanziieren und sie für jede Entity aktivieren.

```typescript
import { entity, PrimaryKey, AutoIncrement } from '@deepkit/type';
import { SoftDelete } from '@deepkit/orm';

@entity.name('user')
class User {
    id: number & PrimaryKey & AutoIncrement = 0;
    created: Date = new Date;

    // Dieses Feld dient als Indikator dafür, ob der Datensatz soft gelöscht ist.
    // Wenn es gesetzt ist, ist der Datensatz soft gelöscht.
    deletedAt?: Date;

    // Dieses Feld ist optional und kann verwendet werden, um nachzuverfolgen, wer/was den Datensatz gelöscht hat.
    deletedBy?: string;

    constructor(
        public name: string
    ) {
    }
}

const softDelete = new SoftDelete(database);
softDelete.enable(User);

// oder wieder deaktivieren
softDelete.disable(User);
```

## Löschen

Um Datensätze soft zu löschen, verwenden Sie die üblichen Methoden: `deleteOne` oder `deleteMany` in einer Abfrage, oder verwenden Sie die Session, um sie zu löschen. Das Soft-Delete-Plugin erledigt den Rest automatisch im Hintergrund.

## Wiederherstellen

Gelöschte Datensätze können mit einer "lifted query" über `SoftDeleteQuery` wiederhergestellt werden. Sie bietet `restoreOne` und `restoreMany`.

```typescript
import { SoftDeleteQuery } from '@deepkit/orm';

await database.query(User).lift(SoftDeleteQuery).filter({ id: 1 }).restoreOne();
await database.query(User).lift(SoftDeleteQuery).filter({ id: 1 }).restoreMany();
```

Die Session unterstützt ebenfalls das Wiederherstellen von Elementen.

```typescript
import { SoftDeleteSession } from '@deepkit/orm';

const session = database.createSession();
const user1 = session.query(User).findOne();

session.from(SoftDeleteSession).restore(user1);
await session.commit();
```

## Hard Delete

Um Datensätze hart zu löschen, verwenden Sie eine "lifted query" über SoftDeleteQuery. Dies stellt im Wesentlichen das normale Verhalten wieder her, bei dem kein Soft-Delete-Plugin verwendet wird.

```typescript
import { SoftDeleteQuery } from '@deepkit/orm';

// den Datensatz wirklich aus der Datenbank löschen
await database.query(User).lift(SoftDeleteQuery).hardDeleteOne();
await database.query(User).lift(SoftDeleteQuery).hardDeleteMany();

// diese sind äquivalent zu den obigen
await database.query(User).lift(SoftDeleteQuery).withSoftDeleted().deleteOne();
await database.query(User).lift(SoftDeleteQuery).withSoftDeleted().deleteMany();
```

## Gelöschte abfragen.

Mit einer "lifted" Query über `SoftDeleteQuery` können Sie auch gelöschte Datensätze einbeziehen.

```typescript
import { SoftDeleteQuery } from '@deepkit/orm';

// alle finden, soft gelöscht und nicht gelöscht
await database.query(User).lift(SoftDeleteQuery).withSoftDeleted().find();

// nur soft gelöschte finden
await database.query(s).lift(SoftDeleteQuery).isSoftDeleted().count()
```

## Gelöscht von

`deletedBy` kann über Abfragen und Sessions gesetzt werden.

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