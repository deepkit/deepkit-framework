# @deepkit/orm Errors

Error codes for the `@deepkit/orm` package follow the format `DK-O###`.

## DK-O001: Database Error

**Message:** [Database-specific error message]

**Causes:**
- General database operation failure
- Connection issues
- Query execution errors
- Database server unavailable

**Solution:**
1. Check database connection settings
2. Verify the database server is running and accessible
3. Check the error message for specific database driver errors
4. Ensure proper error handling with try/catch blocks

---

## DK-O010: Database Insert Error

**Message:** [Insert operation failure details]

**Causes:**
- Attempting to insert data that violates database constraints
- Required fields are null or missing
- Foreign key constraint violation
- Data type mismatch between entity and database schema

**Solution:**
1. Validate entity data before insertion
2. Ensure all required fields have values
3. Check that foreign key references exist
4. Verify database schema matches entity definition

Example:
```typescript
try {
    await database.persist(newUser);
} catch (error) {
    if (error instanceof DatabaseInsertError) {
        console.log('Failed to insert:', error.entity.getClassName());
        console.log('Items:', error.items);
    }
}
```

---

## DK-O011: Database Update Error

**Message:** [Update operation failure details]

**Causes:**
- Attempting to update a record that no longer exists
- Concurrent modification conflict
- Update violates database constraints
- Optimistic locking failure

**Solution:**
1. Verify the record exists before updating
2. Handle concurrent modification scenarios
3. Check that updated values meet all constraints
4. Refresh entity state if using optimistic locking

---

## DK-O012: Database Patch Error

**Message:** [Patch operation failure details]

**Causes:**
- Query-based update failed
- Invalid patch values
- Constraint violation during batch update
- Permission denied on affected rows

**Solution:**
1. Verify the patch values are valid for the target fields
2. Check that the query filter matches expected records
3. Ensure updates don't violate unique or foreign key constraints

Example:
```typescript
try {
    await database.query(User)
        .filter({ active: true })
        .patchMany({ lastLogin: new Date() });
} catch (error) {
    if (error instanceof DatabasePatchError) {
        console.log('Patch failed for:', error.entity.getClassName());
    }
}
```

---

## DK-O013: Database Delete Error

**Message:** [Delete operation failure details]

**Causes:**
- Foreign key constraint prevents deletion
- Record is referenced by other tables
- Permission denied
- Record does not exist

**Solution:**
1. Delete or update dependent records first
2. Use cascading deletes if appropriate
3. Check database permissions
4. Handle "not found" cases gracefully

---

## DK-O020: Database Validation Error

**Message:** Validation error for class [ClassName]: [validation errors]

**Causes:**
- Entity data fails validation before database operation
- Type constraints violated (e.g., string too long, number out of range)
- Required fields missing or null
- Custom validators failing

**Solution:**
1. Validate data before persisting to the database
2. Check validation error details for specific field issues
3. Ensure entity values match their type constraints

Example:
```typescript
import { DatabaseValidationError } from '@deepkit/orm';

try {
    await database.persist(entity);
} catch (error) {
    if (error instanceof DatabaseValidationError) {
        console.log('Validation failed for:', error.classSchema.getClassName());
        for (const err of error.errors) {
            console.log(`  ${err.path}: ${err.message}`);
        }
    }
}
```

---

## DK-O101: Unknown Field

**Message:** Unknown field '[field]' in [ClassName].

**Causes:**
- Using `select()` with a field name that doesn't exist on the entity
- Typo in the field name
- Field was renamed or removed from the entity

**Solution:**
1. Verify the field name is spelled correctly
2. Check that the field exists on the entity class
3. Use `ReflectionClass.from(Entity).getProperties()` to list available fields

Example:
```typescript
// Correct usage
const users = await database.query(User)
    .select('id', 'name', 'email')  // All fields must exist on User
    .find();
```

---

## DK-O102: Relation Not Joined

**Message:** Cannot order by '[field]' because relation '[relation]' is not joined. Use join('[relation]') first.

**Causes:**
- Attempting to order by a field in a related entity without joining it first
- Forgetting to call `join()`, `useJoin()`, or `joinWith()` before ordering

**Solution:**
Join the relation before ordering by its fields:

```typescript
// Wrong - relation not joined
const posts = await database.query(Post)
    .orderBy('author.name')  // Error: author not joined
    .find();

// Correct - join the relation first
const posts = await database.query(Post)
    .join('author')
    .orderBy('author.name')
    .find();
```

---

## DK-O103: Field Not a Reference

**Message:** Field '[field]' is not marked as reference. Use the Reference type annotation.

**Causes:**
- Attempting to join on a field that is not a reference
- Missing `Reference` or `BackReference` type annotation
- Using `join()` on a regular property instead of a relationship

**Solution:**
Mark the field as a reference:

```typescript
import { Reference, BackReference, PrimaryKey } from '@deepkit/type';

class Post {
    id: number & PrimaryKey = 0;
    author: User & Reference = undefined!;  // Reference to User
}

class User {
    id: number & PrimaryKey = 0;
    posts: Post[] & BackReference = [];  // Back reference to Post
}
```

---

## DK-O104: Join Not Found

**Message:** No join for reference '[field]' added. Use join('[field]') first.

**Causes:**
- Calling `getJoin()` for a relation that hasn't been joined
- Forgetting to call `join()` before using `getJoin()`

**Solution:**
Join the relation before accessing it:

```typescript
const query = database.query(Post)
    .join('author')  // First join the relation
    .getJoin('author')  // Then access the join
    .filter({ active: true })
    .end();
```

---

## DK-O105: Composite Primary Key

**Message:** Entity [ClassName] has a composite primary key. Use ids(false) to get all key fields.

**Causes:**
- Calling `ids(true)` on an entity with multiple primary key fields
- Expecting a single-value array when the entity has a composite key

**Solution:**
Use `ids(false)` for composite keys to get all key fields:

```typescript
// For entities with a single primary key
const ids = await database.query(User).ids(true);  // number[]

// For entities with composite primary keys
const keys = await database.query(OrderItem).ids(false);  // { orderId, productId }[]
```

---

## DK-O100: Unique Constraint Failure

**Message:** [Unique constraint violation details]

**Causes:**
- Attempting to insert or update a record with a duplicate unique value
- Unique index violation
- Primary key conflict

**Solution:**
1. Check for existing records with the same unique value before insert
2. Use upsert operations when appropriate
3. Handle the error gracefully with user-friendly messages

Example:
```typescript
import { UniqueConstraintFailure } from '@deepkit/orm';

try {
    await database.persist(user);
} catch (error) {
    if (error instanceof UniqueConstraintFailure) {
        throw new Error('A user with this email already exists');
    }
    throw error;
}
```

---

## DK-O200: Item Not Found

**Message:** Item [type] not found.

**Causes:**
- Using `findOne()` when no matching record exists
- Record was deleted between query and access
- Filter conditions match no records

**Solution:**
1. Use `findOneOrUndefined()` if the record may not exist
2. Check filter conditions
3. Handle the not found case appropriately

Example:
```typescript
import { ItemNotFound } from '@deepkit/orm';

// Option 1: Handle with try/catch
try {
    const user = await database.query(User).filter({ id }).findOne();
} catch (error) {
    if (error instanceof ItemNotFound) {
        return null; // or throw custom error
    }
    throw error;
}

// Option 2: Use findOneOrUndefined (preferred)
const user = await database.query(User).filter({ id }).findOneOrUndefined();
if (!user) {
    // Handle not found case
}
```

---

## DK-O300: Session Closed

**Message:** Session has been closed.

**Causes:**
- Attempting to use a database session after it has been closed
- Using session operations after commit/rollback without starting a new transaction
- Session was explicitly closed or garbage collected

**Solution:**
1. Create a new session for new operations
2. Ensure all session operations complete before closing
3. Don't reuse sessions after they've been committed or rolled back

Example:
```typescript
const session = database.createSession();
try {
    session.useTransaction();
    session.add(entity);
    await session.commit();  // Session transaction ends here
} catch (error) {
    await session.rollback();
    throw error;
}

// For new operations, create a new session
const newSession = database.createSession();
```

---
