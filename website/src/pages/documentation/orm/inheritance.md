# Inheritance

There are several ways to implement inheritance in Deepkit ORM.

## Class Inheritance

One way is the use of class inheritance, which uses simple classes with `extends`.

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

Since `BaseModel` will not be used as entity, it isn't registered in the database. Only `User` and `Customer` will be registered as entities and mapped to a table with all the properties of `BaseModel` included.

The SQL tables would look like this:

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

Single Table Inheritance is a way to store multiple entities in one table.  Instead of having separate tables for each model, a single table is used, and an additional column (often named type or similar) is utilized to determine the type of each record. This is useful if you have a lot of entities that share the same properties.

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

The `Person` class is not an entity and thus not registered in the database. The `Employee` and `Freelancer` classes are entities and will be mapped to a single table with the name `persons`. The `type` column will be used to determine the type of each record.

A SQL table would look like this:

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

As you can see budget is made optional (even though in `Freelance` class it is required). This is to support inserting `Employee` (which doesn't have a budget value)
into the same table. This is a limitation of the single table inheritance.
