# Vererbung

Es gibt mehrere Möglichkeiten, Vererbung in Deepkit ORM zu implementieren.

## Klassenvererbung

Eine Möglichkeit ist die Verwendung von Klassenvererbung, die einfache Klassen mit `extends` verwendet.

```typescript
import { PrimaryKey, AutoIncrement } from '@deepkit/type';

class BaseModel {
    id: number & PrimaryKey & AutoIncrement = 0;
    created: Date = new Date;
    updated: Date = new Date;
}

class User extends BaseModel {
    name: string = '';
}

class Customer extends BaseModel {
    name: string = '';
    address: string = '';
}

new Database(
    new SQLiteDatabaseAdapter('./example.sqlite'),
    [User, Customer]
);
```

Da `BaseModel` nicht als Entity verwendet wird, wird es nicht in der Datenbank registriert. Nur `User` und `Customer` werden als Entities registriert und einer Tabelle zugeordnet, die alle Properties von `BaseModel` enthält.

Die SQL-Tabellen würden so aussehen:

```sql
CREATE TABLE user (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    created TEXT NOT NULL,
    updated TEXT NOT NULL,
    name TEXT NOT NULL
);

CREATE TABLE customer (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    created TEXT NOT NULL,
    updated TEXT NOT NULL,
    name TEXT NOT NULL,
    address TEXT NOT NULL
);
```

## Single Table Inheritance

Single Table Inheritance ist eine Möglichkeit, mehrere Entities in einer Tabelle zu speichern. Anstatt separate Tabellen für jedes Model zu haben, wird eine einzelne Tabelle verwendet, und eine zusätzliche Spalte (oft type oder ähnlich genannt) wird genutzt, um den Typ jedes Datensatzes zu bestimmen. Das ist nützlich, wenn Sie viele Entities haben, die dieselben Properties teilen.

```typescript
import { PrimaryKey, AutoIncrement, entity } from '@deepkit/type';

@entity.collection('persons')
abstract class Person {
    id: number & PrimaryKey & AutoIncrement = 0;
    firstName?: string;
    lastName?: string;
    abstract type: string;
}

@entity.singleTableInheritance()
class Employee extends Person {
    email?: string;

    type: 'employee' = 'employee';
}

@entity.singleTableInheritance()
class Freelancer extends Person {
    @t budget: number = 10_000;

    type: 'freelancer' = 'freelancer';
}

new Database(
    new SQLiteDatabaseAdapter('./example.sqlite'), 
    [Employee, Freelancer]
);
```

Die Klasse `Person` ist keine Entity und wird daher nicht in der Datenbank registriert. Die Klassen `Employee` und `Freelancer` sind Entities und werden auf eine einzelne Tabelle mit dem Namen `persons` abgebildet. Die Spalte `type` wird verwendet, um den Typ jedes Datensatzes zu bestimmen.

Eine SQL-Tabelle würde so aussehen:

```sql
CREATE TABLE persons (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    firstName TEXT,
    lastName TEXT,
    type TEXT NOT NULL,
    email TEXT,
    budget INTEGER
);
``` 

Wie Sie sehen, wird budget optional gemacht (obwohl es in der Klasse `Freelance` erforderlich ist). Das dient dazu, das Einfügen von `Employee` (das keinen budget-Wert hat) in dieselbe Tabelle zu unterstützen. Das ist eine Einschränkung von Single Table Inheritance.