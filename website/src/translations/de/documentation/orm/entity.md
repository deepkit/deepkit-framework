# Entity

Eine Entity ist entweder eine Class oder ein Object Literal (Interface) und hat immer einen Primary Key.
Die Entity wird mit allen notwendigen Informationen über Type Annotations aus `@deepkit/type` versehen. Zum Beispiel wird ein Primary Key definiert sowie verschiedene Felder und deren Validierungs-Constraints. Diese Felder spiegeln die Datenbankstruktur wider, in der Regel eine Tabelle oder eine Collection.

Durch spezielle Type Annotations wie `Mapped<'name'>` kann ein Feldname auch auf einen anderen Namen in der Datenbank gemappt werden.

## Class

```typescript
import { entity, PrimaryKey, AutoIncrement, Unique, MinLength, MaxLength } from '@deepkit/type';

@entity.name('user')
class User {
    id: number & PrimaryKey & AutoIncrement = 0;
    created: Date = new Date;
    firstName?: string;
    lastName?: string;

    constructor(
        public username: string & Unique & MinLength<2> & MaxLength<16>,
        public email: string & Unique,
    ) {}
}

const database = new Database(new SQLiteDatabaseAdapter(':memory:'), [User]);
await database.migrate();

await database.persist(new User('Peter'));

const allUsers = await database.query(User).find();
console.log('all users', allUsers);
```

## Interface

```typescript
import { PrimaryKey, AutoIncrement, Unique, MinLength, MaxLength } from '@deepkit/type';

interface User {
    id: number & PrimaryKey & AutoIncrement = 0;
    created: Date = new Date;
    firstName?: string;
    lastName?: string;
    username: string & Unique & MinLength<2> & MaxLength<16>;
}

const database = new Database(new SQLiteDatabaseAdapter(':memory:'));
database.register<User>({name: 'user'});

await database.migrate();

const user: User = {id: 0, created: new Date, username: 'Peter'};
await database.persist(user);

const allUsers = await database.query<User>().find();
console.log('all users', allUsers);
```

## Primitive

Primitive Datentypen wie String, Number (bigint) und Boolean werden auf gängige Datenbanktypen gemappt. Es wird nur der TypeScript Type verwendet.

```typescript

interface User {
    logins: number;
    username: string;
    pro: boolean;
}
```

## Primary Key

Jede Entity benötigt genau einen Primary Key. Mehrere Primary Keys werden nicht unterstützt.

Der Basistype eines Primary Keys kann beliebig sein. Häufig wird eine number oder eine UUID verwendet.
Für MongoDB wird oft die MongoId oder ObjectID genutzt.

Für Zahlen kann `AutoIncrement` verwendet werden.

```typescript
import { PrimaryKey } from '@deepkit/type';

interface User {
    id: number & PrimaryKey;
}
```

## Auto Increment

Felder, die beim Insert automatisch inkrementiert werden sollen, werden mit dem `AutoIncrement` Decorator annotiert. Alle Adapter unterstützen Auto-Increment-Werte. Der MongoDB Adapter verwendet eine zusätzliche Collection, um den Zähler nachzuverfolgen.

Ein Auto-Increment-Feld ist ein automatischer Zähler und kann nur auf einen Primary Key angewendet werden. Die Datenbank stellt automatisch sicher, dass eine ID nur einmal verwendet wird.

```typescript
import { PrimaryKey, AutoIncrement } from '@deepkit/type';

interface User {
    id: number & PrimaryKey & AutoIncrement;
}
```

## UUID

Felder, die vom Type UUID (v4) sein sollen, werden mit dem Decorator UUID annotiert. Der Runtime Type ist `string` und in der Datenbank selbst meist binär. Verwende die Function `uuid()`, um eine neue UUID v4 zu erzeugen.

```typescript
import { uuid, UUID, PrimaryKey } from '@deepkit/type';

class User {
    id: UUID & PrimaryKey = uuid();
}
```

## MongoDB ObjectID

Felder, die in MongoDB vom Type ObjectID sein sollen, werden mit dem Decorator `MongoId` annotiert. Der Runtime Type ist `string` und in der Datenbank selbst `ObjectId` (binär).

MongoID-Felder erhalten beim Insert automatisch einen neuen Wert. Es ist nicht zwingend erforderlich, den Feldnamen `_id` zu verwenden. Er kann beliebig sein.

```typescript
import { PrimaryKey, MongoId } from '@deepkit/type';

class User {
    id: MongoId & PrimaryKey = '';
}
```

## Optional / Nullable

Optionale Felder werden als TypeScript Type mit `title?: string` oder `title: string | null` deklariert. Du solltest nur eine dieser Varianten verwenden, üblicherweise die optionale `?`-Syntax, die mit `undefined` funktioniert.
Beide Varianten führen dazu, dass der Datenbanktyp bei allen SQL Adaptern `NULLABLE` ist. Der einzige Unterschied zwischen diesen Varianten ist, dass sie zur Runtime unterschiedliche Werte repräsentieren.

Im folgenden Beispiel ist das Feld modified optional und kann zur Runtime daher undefined sein, obwohl es in der Datenbank immer als NULL dargestellt wird.

```typescript
import { PrimaryKey } from '@deepkit/type';

class User {
    id: number & PrimaryKey = 0;
    modified?: Date;
}
```

Dieses Beispiel zeigt, wie der Nullable Type funktioniert. NULL wird sowohl in der Datenbank als auch in der JavaScript-Runtime verwendet. Das ist ausführlicher als `modified?: Date` und wird nicht häufig genutzt.

```typescript
import { PrimaryKey } from '@deepkit/type';

class User {
    id: number & PrimaryKey = 0;
    modified: Date | null = null;
}
```

## Datenbank-Typ-Mapping

|===
|Laufzeittyp|SQLite|MySQL|Postgres|Mongo

|string|text|longtext|text|string
|number|float|double|double precision|int/number
|boolean|integer(1)|boolean|boolean|boolean
|date|text|datetime|timestamp|datetime
|array|text|json|jsonb|array
|map|text|json|jsonb|object
|map|text|json|jsonb|object
|union|text|json|jsonb|T
|uuid|blob|binary(16)|uuid|binary
|ArrayBuffer/Uint8Array/...|blob|longblob|bytea|binary
|===

Mit `DatabaseField` ist es möglich, ein Feld auf jeden beliebigen Datenbanktyp zu mappen. Der Type muss ein gültiges SQL-Statement sein, das unverändert an das Migrationssystem weitergegeben wird.

```typescript
import { DatabaseField } from '@deepkit/type';

interface User {
    title: string & DatabaseField<{type: 'VARCHAR(244)'}>;
}
```

Um ein Feld für eine spezifische Datenbank zu mappen, können entweder `SQLite`, `MySQL` oder `Postgres` verwendet werden.

### SQLite

```typescript
import { SQLite } from '@deepkit/type';

interface User {
    title: string & SQLite<{type: 'text'}>;
}
```

### MySQL

```typescript
import { MySQL } from '@deepkit/type';

interface User {
    title: string & MySQL<{type: 'text'}>;
}
```

### Postgres

```typescript
import { Postgres } from '@deepkit/type';

interface User {
    title: string & Postgres<{type: 'text'}>;
}
```

## Eingebettete Types

## Standardwerte

## Default-Ausdrücke

## Komplexe Types

## Exclude

## Datenbankspezifische Spaltentypen