# Session / Unit Of Work

Eine Session ist so etwas wie eine Unit of Work. Sie verfolgt alles, was Sie tun, und zeichnet die Änderungen automatisch auf, sobald `commit()` aufgerufen wird. Sie ist der bevorzugte Weg, Änderungen in der Datenbank auszuführen, da sie Statements so bündelt, dass die Ausführung sehr schnell ist. Eine Session ist sehr leichtgewichtig und kann beispielsweise leicht in einem Request-Response-Lifecycle erstellt werden.

```typescript
import { SQLiteDatabaseAdapter } from '@deepkit/sqlite';
import { entity, PrimaryKey, AutoIncrement } from '@deepkit/type';
import { Database } from '@deepkit/orm';

async function main() {

    @entity.name('user')
    class User {
        id: number & PrimaryKey & AutoIncrement = 0;
        created: Date = new Date;

        constructor(public name: string) {
        }
    }

    const database = new Database(new SQLiteDatabaseAdapter(':memory:'), [User]);
    await database.migrate();

    const session = database.createSession();
    session.add(new User('User1'), new User('User2'), new User('User3'));

    await session.commit();

    const users = await session.query(User).find();
    console.log(users);
}

main();
```

Fügen Sie eine neue Instanz mit `session.add(T)` zur Session hinzu oder entfernen Sie bestehende Instanzen mit `session.remove(T)`. Sobald Sie mit dem Session-Objekt fertig sind, entfernen Sie einfach überall die Referenzen darauf, damit der Garbage Collector es entfernen kann.

Änderungen werden für über das Session-Objekt geladene Entity-Instanzen automatisch erkannt.

```typescript
const users = await session.query(User).find();
for (const user of users) {
    user.name += ' changed';
}

await session.commit();//speichert alle User
```

## Identity Map

Sessions stellen eine Identity Map bereit, die sicherstellt, dass es pro Datenbankeintrag nur genau ein JavaScript-Objekt gibt. Wenn Sie z. B. `session.query(User).find()` zweimal innerhalb derselben Session ausführen, erhalten Sie zwei unterschiedliche Arrays, jedoch mit denselben Entity-Instanzen darin.

Wenn Sie mit `session.add(entity1)` eine neue Entity hinzufügen und sie erneut abrufen, erhalten Sie genau dieselbe Entity-Instanz `entity1`.

Wichtig: Sobald Sie Sessions verwenden, sollten Sie deren `session.query`-Methode statt `database.query` verwenden. Nur Session-Queries haben das Identity-Mapping-Feature aktiviert.

## Change Detection

## Request/Response