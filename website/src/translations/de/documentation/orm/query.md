# Query

Eine Query ist ein Objekt, das beschreibt, wie Daten aus der Datenbank abgerufen oder verändert werden. Sie hat mehrere Methoden, um die Query zu beschreiben, und Abschlussmethoden, die sie ausführen. Der Database Adapter kann die Query-API auf viele Arten erweitern, um datenbankspezifische Features zu unterstützen.

Eine Query kann mit `Database.query(T)` oder `Session.query(T)` erstellt werden. Wir empfehlen Sessions, da dies die Performance verbessert.

```typescript
@entity.name('user')
class User {
    id: number & PrimaryKey & AutoIncrement = 0;
    created: Date = new Date;
    birthdate?: Date;
    visits: number = 0;

    constructor(public username: string) {
    }
}

const database = new Database(...);

//[ { username: 'User1' }, { username: 'User2' }, { username: 'User2' } ]
const users = await database.query(User).select('username').find();
```

## Filter

Ein Filter kann angewendet werden, um die Ergebnismenge einzuschränken.

```typescript
//einfache Filter
const users = await database.query(User).filter({name: 'User1'}).find();

//mehrere Filter, alle AND
const users = await database.query(User).filter({name: 'User1', id: 2}).find();

//Bereichsfilter: $gt, $lt, $gte, $lte (größer als, kleiner als, ...)
//entspricht WHERE created < NOW()
const users = await database.query(User).filter({created: {$lt: new Date}}).find();
//entspricht WHERE id > 500
const users = await database.query(User).filter({id: {$gt: 500}}).find();
//entspricht WHERE id >= 500
const users = await database.query(User).filter({id: {$gte: 500}}).find();

//Set-Filter: $in, $nin (in, not in)
//entspricht WHERE id IN (1, 2, 3)
const users = await database.query(User).filter({id: {$in: [1, 2, 3]}}).find();

//Regex-Filter
const users = await database.query(User).filter({username: {$regex: /User[0-9]+/}}).find();

//Gruppierung: $and, $nor, $or
//entspricht WHERE (username = 'User1') OR (username = 'User2')
const users = await database.query(User).filter({
    $or: [{username: 'User1'}, {username: 'User2'}]
}).find();


//verschachtelte Gruppierung
//entspricht WHERE username = 'User1' OR (username = 'User2' and id > 0)
const users = await database.query(User).filter({
    $or: [{username: 'User1'}, {username: 'User2', id: {$gt: 0}}]
}).find();


//verschachtelte Gruppierung
//entspricht WHERE username = 'User1' AND (created < NOW() OR id > 0)
const users = await database.query(User).filter({
    $and: [{username: 'User1'}, {$or: [{created: {$lt: new Date}, id: {$gt: 0}}]}]
}).find();
```

### Equal

### Greater / Smaller

### RegExp

### Grouping AND/OR

### In

## Select

Um die Felder einzugrenzen, die aus der Datenbank abgerufen werden, kann `select('field1')` verwendet werden.

```typescript
const user = await database.query(User).select('username').findOne();
const user = await database.query(User).select('id', 'username').findOne();
```

Wichtig ist: Sobald die Felder mit `select` eingegrenzt werden, sind die Ergebnisse keine Instanzen der Entity mehr, sondern nur noch Object-Literals.

```
const user = await database.query(User).select('username').findOne();
user instanceof User; //false
```

## Order

Mit `orderBy(field, order)` kann die Reihenfolge der Einträge geändert werden.
`orderBy` kann mehrfach ausgeführt werden, um die Sortierung immer weiter zu verfeinern.

```typescript
const users = await session.query(User).orderBy('created', 'desc').find();
const users = await session.query(User).orderBy('created', 'asc').find();
```

## Pagination

Die Methoden `itemsPerPage()` und `page()` können verwendet werden, um die Ergebnisse zu paginieren. Die Page beginnt bei 1.

```typescript
const users = await session.query(User).itemsPerPage(50).page(1).find();
```

Mit den alternativen Methoden `limit` und `skip` kann man manuell paginieren.

```typescript
const users = await session.query(User).limit(5).skip(10).find();
```

[#database-join]
## Join

Standardmäßig werden References aus der Entity weder in Queries berücksichtigt noch geladen. Um einen Join in die Query einzuschließen, ohne die Reference zu laden, verwenden Sie `join()` (Left Join) oder `innerJoin()`. Um einen Join in die Query einzuschließen und die Reference zu laden, verwenden Sie `joinWith()` oder `innerJoinWith()`.

Alle folgenden Beispiele gehen von diesen Model-Schemas aus:

```typescript
@entity.name('group')
class Group {
    id: number & PrimaryKey & AutoIncrement = 0;
    created: Date = new Date;

    constructor(public username: string) {
    }
}

@entity.name('user')
class User {
    id: number & PrimaryKey & AutoIncrement = 0;
    created: Date = new Date;

    group?: Group & Reference;

    constructor(public username: string) {
    }
}
```

```typescript
//wählt nur Users mit einer zugewiesenen group (INNER JOIN)
const users = await session.query(User).innerJoin('group').find();
for (const user of users) {
    user.group; //Fehler, da die Referenz nicht geladen wurde
}
```

```typescript
//wählt nur Users mit einer zugewiesenen group (INNER JOIN) und lädt die Relation
const users = await session.query(User).innerJoinWith('group').find();
for (const user of users) {
    user.group.name; //funktioniert
}
```

Um Join-Queries zu modifizieren, verwenden Sie dieselben Methoden, jedoch mit dem Prefix `use`: `useJoin`, `useInnerJoin`, `useJoinWith` oder `useInnerJoinWith`. Um die Join-Query-Modifikation zu beenden, verwenden Sie `end()`, um zur Parent-Query zurückzukehren.

```typescript
//wählt nur Users mit einer group mit dem Namen 'admins' (INNER JOIN)
const users = await session.query(User)
    .useInnerJoinWith('group')
        .filter({name: 'admins'})
        .end()  // kehrt zur Parent-Query zurück
    .find();

for (const user of users) {
    user.group.name; //immer admin
}
```

## Aggregation

Aggregation-Methoden ermöglichen es, Records zu zählen und Felder zu aggregieren.

Die folgenden Beispiele gehen von diesem Model-Schema aus:

```typescript
@entity.name('file')
class File {
    id: number & PrimaryKey & AutoIncrement = 0;
    created: Date = new Date;

    downloads: number = 0;

    category: string = 'none';

    constructor(public path: string & Index) {
    }
}
```

`groupBy` ermöglicht es, das Ergebnis nach dem angegebenen Feld zu gruppieren.

```typescript
await database.persist(
    cast<File>({path: 'file1', category: 'images'}),
    cast<File>({path: 'file2', category: 'images'}),
    cast<File>({path: 'file3', category: 'pdfs'})
);

//[ { category: 'images' }, { category: 'pdfs' } ]
await session.query(File).groupBy('category').find();
```

Es gibt mehrere Aggregation-Methoden: `withSum`, `withAverage`, `withCount`, `withMin`, `withMax`, `withGroupConcat`. Jede benötigt einen Feldnamen als erstes Argument und optional ein zweites Argument, um den Alias zu ändern.

```typescript
//zuerst aktualisieren wir einige Records:
await database.query(File).filter({path: 'images/file1'}).patchOne({$inc: {downloads: 15}});
await database.query(File).filter({path: 'images/file2'}).patchOne({$inc: {downloads: 5}});

//[{ category: 'images', downloads: 20 },{ category: 'pdfs', downloads: 0 }]
await session.query(File).groupBy('category').withSum('downloads').find();

//[{ category: 'images', downloads: 10 },{ category: 'pdfs', downloads: 0 }]
await session.query(File).groupBy('category').withAverage('downloads').find();

//[ { category: 'images', amount: 2 }, { category: 'pdfs', amount: 1 } ]
await session.query(File).groupBy('category').withCount('id', 'amount').find();
```

## Returning

Mit `returning` können bei Änderungen über `patch` und `delete` zusätzliche Felder angefordert werden.

Achtung: Nicht alle Database Adapter liefern Felder atomar zurück. Verwenden Sie Transactions, um Datenkonsistenz sicherzustellen.

```typescript
await database.query(User).patchMany({visits: 0});

//{ modified: 1, returning: { visits: [ 5 ] }, primaryKeys: [ 1 ] }
const result = await database.query(User)
    .filter({username: 'User1'})
    .returning('username', 'visits')
    .patchOne({$inc: {visits: 5}});
```

## Find

Gibt ein Array von Einträgen zurück, die dem angegebenen Filter entsprechen.

```typescript
const users: User[] = await database.query(User).filter({username: 'Peter'}).find();
```

## FindOne

Gibt einen Eintrag zurück, der dem angegebenen Filter entspricht.
Wenn kein Eintrag gefunden wird, wird ein `ItemNotFound` Error ausgelöst.

```typescript
const users: User = await database.query(User).filter({username: 'Peter'}).findOne();
```

## FindOneOrUndefined

Gibt einen Eintrag zurück, der dem angegebenen Filter entspricht.
Wenn kein Eintrag gefunden wird, wird undefined zurückgegeben.

```typescript
const query = database.query(User).filter({username: 'Peter'});
const users: User|undefined = await query.findOneOrUndefined();
```

## FindField

Gibt eine Liste eines Feldes zurück, die dem angegebenen Filter entspricht.

```typescript
const usernames: string[] = await database.query(User).findField('username');
```

## FindOneField

Gibt eine Liste eines Feldes zurück, die dem angegebenen Filter entspricht.
Wenn kein Eintrag gefunden wird, wird ein `ItemNotFound` Error ausgelöst.

```typescript
const username: string = await database.query(User).filter({id: 3}).findOneField('username');
```

## Patch

Patch ist eine Change-Query, die die in der Query beschriebenen Records patcht. Die Methoden
`patchOne` und `patchMany` beenden die Query und führen den Patch aus.

`patchMany` ändert alle Records in der Datenbank, die dem angegebenen Filter entsprechen. Wenn kein Filter gesetzt ist, wird die gesamte Tabelle geändert. Verwenden Sie `patchOne`, um jeweils nur einen Eintrag zu ändern.

```typescript
await database.query(User).filter({username: 'Peter'}).patch({username: 'Peter2'});

await database.query(User).filter({username: 'User1'}).patchOne({birthdate: new Date});
await database.query(User).filter({username: 'User1'}).patchOne({$inc: {visits: 1}});

await database.query(User).patchMany({visits: 0});
```

## Delete

`deleteMany` löscht alle Einträge in der Datenbank, die dem angegebenen Filter entsprechen.
Wenn kein Filter gesetzt ist, wird die gesamte Tabelle gelöscht. Verwenden Sie `deleteOne`, um jeweils nur einen Eintrag zu löschen.

```typescript
const result = await database.query(User)
    .filter({visits: 0})
    .deleteMany();

const result = await database.query(User).filter({id: 4}).deleteOne();
```

## Has

Gibt zurück, ob mindestens ein Eintrag in der Datenbank existiert.

```typescript
const userExists: boolean = await database.query(User).filter({username: 'Peter'}).has();
```

## Count

Gibt die Anzahl der Einträge zurück.

```typescript
const userCount: number = await database.query(User).count();
```

## Lift

Eine Query zu liften bedeutet, ihr neue Funktionalität hinzuzufügen. Dies wird üblicherweise entweder von Plugins oder in komplexen Architekturen verwendet, um größere Query-Klassen in mehrere bequeme, wiederverwendbare Klassen aufzuteilen.

```typescript
import { FilterQuery, Query } from '@deepkit/orm';

class UserQuery<T extends {birthdate?: Date}> extends Query<T>  {
    hasBirthday() {
        const start = new Date();
        start.setHours(0,0,0,0);
        const end = new Date();
        end.setHours(23,59,59,999);

        return this.filter({$and: [{birthdate: {$gte: start}}, {birthdate: {$lte: end}}]} as FilterQuery<T>);
    }
}

await session.query(User).lift(UserQuery).hasBirthday().find();
```