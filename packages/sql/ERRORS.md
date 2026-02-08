# @deepkit/sql Errors

All errors in `@deepkit/sql` extend the `SqlError` base class, which extends `DeepkitError`. This allows you to catch all SQL-related errors with a single catch block:

```typescript
import { SqlError } from '@deepkit/sql';

try {
    await database.query(User).find();
} catch (error) {
    if (error instanceof SqlError) {
        // Handle any SQL error
        console.log('SQL error code:', error.code);
    }
}
```

---

## DK-SQL001: No Comparison Operators at Root

**Message:** `No comparison operators at root level allowed`

**Causes:**
- Using comparison operators (`$gt`, `$lt`, `$eq`, etc.) directly at the root level of a filter query
- Filter structure is malformed

**Solution:**
Wrap comparison operators inside a field name:

```typescript
// Wrong - comparison at root level
query.filter({ $gt: 5 });

// Correct - comparison inside field
query.filter({ age: { $gt: 5 } });
```

---

## DK-SQL002: Comparator Not Supported

**Message:** `Comparator {comparison} not supported.`

**Causes:**
- Using an unknown or unsupported comparison operator in a filter
- Typo in the operator name
- Using a MongoDB-style operator that isn't implemented

**Solution:**
Use supported comparison operators:
- `$eq`, `$ne` - equality
- `$gt`, `$gte`, `$lt`, `$lte` - numeric comparison
- `$in`, `$nin` - array membership
- `$like`, `$regex` - string matching

```typescript
// Supported operators
query.filter({ name: { $like: '%john%' } });
query.filter({ age: { $gte: 18, $lte: 65 } });
query.filter({ status: { $in: ['active', 'pending'] } });
```

---

## DK-SQL003: No Root Converter

**Message:** `No root converter set`

**Causes:**
- Internal SQL builder error where the root converter wasn't properly initialized
- Attempting to build SQL before the query is fully configured

**Solution:**
This is typically an internal error. Ensure your query is properly constructed before executing:

```typescript
const query = database.query(User);
// Configure query before executing
const results = await query.filter({ active: true }).find();
```

If this error persists, it may indicate a bug in query construction.

---

## DK-SQL004: No Table for Entity

**Message:** `No table for entity {ClassName}`

**Causes:**
- The entity class is not registered with the database
- Missing database decorator on the entity
- Entity was not included in the database schema

**Solution:**
Ensure your entity is properly decorated and registered:

```typescript
import { entity, PrimaryKey, AutoIncrement } from '@deepkit/type';

@entity.name('user')
class User {
    id: number & PrimaryKey & AutoIncrement = 0;
    name: string = '';
}

// Register with database
const database = new Database(adapter, [User]);
```

---

## DK-SQL005: Table Not Found in Schema

**Message:** `Could not find table {name} in schema {schemaName}`

**Causes:**
- Referencing a table that doesn't exist in the database schema
- Table name mismatch between code and database
- Schema migration hasn't been run

**Solution:**
1. Verify the table exists in your database
2. Check that entity names match table names
3. Run database migrations if needed:

```typescript
// Check your entity name matches
@entity.name('users') // This should match your actual table name
class User { }

// Run migrations
await database.migrate();
```

---

## DK-SQL006: Unknown SQL Type

**Message:** `Could not detect type of sql type {type}`

**Causes:**
- The reverse schema parser encountered an unknown SQL column type
- Database-specific type that isn't mapped
- Type includes parentheses in an unexpected format

**Solution:**
This occurs during schema introspection. The SQL type from your database isn't recognized. You may need to:

1. Use a more standard SQL type in your database
2. Add custom type mapping for your database platform
3. Report the unsupported type as a feature request

---

## DK-SQL007: Entity Has No Properties

**Message:** `Entity {ClassName} has no properties. Is reflection enabled?`

**Causes:**
- TypeScript reflection is not enabled for the entity class
- The type compiler transformer wasn't applied during build
- Entity class has no typed properties

**Solution:**
1. Ensure `@deepkit/type-compiler` is properly configured in your build
2. Check that your entity has typed properties:

```typescript
// Wrong - no typed properties
class User { }

// Correct - with typed properties
class User {
    id: number & PrimaryKey = 0;
    name: string = '';
    email: string = '';
}
```

3. Verify your tsconfig.json includes the type compiler transformer

---

## DK-SQL008: SingleTableInheritance No Super Class

**Message:** `Class {ClassName} has singleTableInheritance enabled but has no super class.`

**Causes:**
- Using `@entity.singleTableInheritance()` on a class that doesn't extend another class
- Single table inheritance requires a class hierarchy

**Solution:**
Single table inheritance requires a base class and derived classes:

```typescript
// Base class
@entity.name('content')
abstract class Content {
    id: number & PrimaryKey & AutoIncrement = 0;
    title: string = '';
}

// Derived classes with single table inheritance
@entity.singleTableInheritance()
class Article extends Content {
    body: string = '';
}

@entity.singleTableInheritance()
class Video extends Content {
    url: string = '';
}
```

---

## DK-SQL009: Referenced Entity Not Available

**Message:** `Referenced entity {ForeignClass} from {Class}.{property} is not available`

**Causes:**
- A foreign key reference points to an entity that isn't registered with the database
- Missing entity in the database schema definition
- Circular reference not properly handled

**Solution:**
Register all referenced entities with your database:

```typescript
class Order {
    id: number & PrimaryKey = 0;
    user: User & Reference = undefined!; // References User entity
}

class User {
    id: number & PrimaryKey = 0;
    name: string = '';
}

// Both entities must be registered
const database = new Database(adapter, [User, Order]);
```

---

## DK-SQL010: Delete with Joins Not Supported

**Message:** `Delete with joins not supported. Fetch first the ids then delete.`

**Causes:**
- Attempting to delete records using a query that includes joins
- Complex delete query that can't be translated to SQL directly

**Solution:**
Fetch the IDs first, then delete:

```typescript
// Wrong - delete with join
await query.useJoin('relation').deleteMany();

// Correct - fetch IDs first, then delete
const ids = await query.useJoin('relation').findField('id');
await database.query(Entity).filter({ id: { $in: ids } }).deleteMany();
```

---

## DK-SQL011: Parameter Not Defined

**Message:** `Parameter {value} not defined in {ClassName} query.`

**Causes:**
- Using a parameter placeholder in a query without providing its value
- Typo in parameter name
- Parameter binding mismatch

**Solution:**
Ensure all parameters are defined when building the query:

```typescript
// Using parameters in queries
const query = database.query(User)
    .filter({ status: ':status' })
    .parameter('status', 'active'); // Define the parameter

// All placeholders must have corresponding parameter() calls
```

---

## DK-SQL012: No Primary Key Defined

**Message:** `No primary key defined for {name}.`

**Causes:**
- Entity class doesn't have a primary key property defined
- Missing `PrimaryKey` type annotation
- Reflection not capturing the primary key

**Solution:**
Define a primary key on your entity:

```typescript
import { PrimaryKey, AutoIncrement } from '@deepkit/type';

class User {
    // Define primary key with type annotation
    id: number & PrimaryKey & AutoIncrement = 0;
    name: string = '';
}

// Or for UUID primary keys
class Document {
    id: string & PrimaryKey & UUID = uuid();
    title: string = '';
}
```

---
