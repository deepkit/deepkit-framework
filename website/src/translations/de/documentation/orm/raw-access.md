# Rohzugriff

Es ist oft notwendig, direkt auf die Datenbank zuzugreifen, z. B. um eine SQL-Query auszuführen, die vom ORM nicht unterstützt wird.
Das kann über die `raw` Method der `Database` Class erfolgen.

```typescript
import { PrimaryKey, AutoIncrement, @entity } from '@deepkit/type';
import { Database } from '@deepkit/orm';
import { sql } from '@deepkit/sql';
import { SqliteDatabaseAdapter } from '@deepkit/sqlite';

@entity.collection('users')
class User {
    id: number & PrimaryKey & AutoIncrement = 0;
    created: Date = new Date;
    constructor(public username: string) {}
}

const database = new Database(new SQLiteDatabaseAdapter(':memory:'), [User]);

const query = 'Pet%';
const rows = await database.raw<User>(sql`SELECT * FROM users WHERE username LIKE ${query}`).find();

const result = await database.raw<{ count: number }>(sql`SELECT count(*) as count FROM users WHERE username LIKE ${query}`).findOne();
console.log('Found', result.count, 'users');
```

Die SQL-Query wird mit dem `sql` Template-String-Tag aufgebaut. Dies ist ein spezielles Template-String-Tag, das erlaubt, Werte als Parameter zu übergeben. Diese Parameter werden dann automatisch geparst und in ein sicheres Prepared Statement konvertiert. Das ist wichtig, um SQL-Injection-Angriffe zu vermeiden.

Um einen dynamischen Identifier wie einen Spaltennamen zu übergeben, kann `identifier` verwendet werden:

```typescript
import { identifier, sql } from '@deepkit/sql';

let column = 'username';
const rows = await database.raw<User>(sql`SELECT * FROM users WHERE ${identifier(column)} LIKE ${query}`).find();
```

Für SQL-Adapter gibt die `raw` Method eine `RawQuery` mit den `findOne`- und `find`-Methods zurück, um die Resultate abzurufen. Um eine SQL-Anweisung ohne Rückgabe von Zeilen auszuführen, wie UPDATE/DELETE/etc., kann `execute` verwendet werden:

```typescript
let username = 'Peter';
await database.raw(sql`UPDATE users SET username = ${username} WHERE id = 1`).execute();
```

`RawQuery` unterstützt außerdem das Auslesen des finalen SQL-Strings und der Parameter, korrekt formatiert für den Datenbank-Adapter:

```typescript
const query = database.raw(sql`SELECT * FROM users WHERE username LIKE ${query}`);
console.log(query.sql);
console.log(query.params);
```

Auf diese Weise kann das SQL z. B. in einem anderen Datenbank-Client ausgeführt werden.

## Types

Beachte, dass an `raw` jeder Type übergeben werden kann und das Resultat aus der Datenbank automatisch in diesen Type konvertiert wird. Das ist besonders nützlich für SQL-Adapter, bei denen eine Class übergeben werden kann und das Resultat automatisch in diese Class konvertiert wird.

Das hat jedoch Einschränkungen. SQL-Joins werden auf diese Weise nicht unterstützt. Wenn Joins verwendet werden sollen, muss der Query Builder des ORM genutzt werden.

## Mongo

Der MongoDB-Adapter funktioniert etwas anders, da er nicht auf SQL-Queries basiert, sondern auf Mongo-Commands.

Ein Command kann eine Aggregation-Pipeline, eine find-Query oder ein Write-Command sein.

```typescript
import { MongoDatabaseAdapter } from '@deepkit/mongo';

const database = new Database(MongoDatabaseAdapter('mongodb://localhost:27017/mydatabase'));

// Erstes Argument ist die Entry-Point-Collection, zweites ist der Return Type des Commands
const items = await database.raw<ChatMessage, { count: number }>([
    { $match: { roomId: 'room1' } },
    { $group: { _id: '$userId', count: { $sum: 1 } } },
]).find();
```