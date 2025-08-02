# Session / Unit Of Work

A session is something like a unit of work. It keeps track of everything you do and automatically records the changes whenever `commit()` is called. It is the preferred way to execute changes in the database because it bundles statements in a way that makes it very fast. A session is very lightweight and can easily be created in a request-response lifecycle, for example.

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

Add new instance to the session with `session.add(T)` or remove existing instances with `session.remove(T)`. Once you are done with the Session object, simply dereference it everywhere so that the garbage collector can remove it.

Changes are automatically detected for entity instances fetched via the Session object.

```typescript
const users = await session.query(User).find();
for (const user of users) {
    user.name += ' changed';
}

await session.commit();//saves all users
```

## Identity Map

The identity map is a key feature of sessions that ensures each entity is loaded only once and maintains object identity:

```typescript
const session = database.createSession();

// First query loads user into identity map
const user1 = await session.query(User).filter({ id: 1 }).findOne();

// Second query returns the same instance from identity map (no database hit)
const user2 = await session.query(User).filter({ id: 1 }).findOne();

console.log(user1 === user2); // true - same object reference

// Changes to either reference affect the same object
user1.username = 'updated';
console.log(user2.username); // 'updated'

await session.commit(); // Saves the changes
```

### Identity Map Benefits:
- **Performance**: Prevents duplicate database queries for the same entity
- **Consistency**: Ensures all references to an entity are the same object
- **Change Tracking**: Automatically detects modifications to entities

### Identity Map Considerations:
- **Memory Usage**: Sessions hold references to all loaded entities
- **Scope**: Identity map is per-session, not global
- **Lifecycle**: Entities remain in memory until session is garbage collected

## Change Detection

Sessions automatically track changes to entities loaded through the session:

```typescript
const session = database.createSession();

// Load entity through session
const user = await session.query(User).findOne();

// Modify properties - changes are automatically tracked
user.username = 'newUsername';
user.email = 'new@email.com';
user.lastLogin = new Date();

// Commit automatically generates UPDATE statement for changed fields only
await session.commit();
// SQL: UPDATE user SET username = ?, email = ?, lastLogin = ? WHERE id = ?
```

### Manual Change Tracking:
```typescript
import { atomicChange } from '@deepkit/type';

const session = database.createSession();
const user = await session.query(User).findOne();

// Use atomicChange for complex modifications
atomicChange(user).username = 'newUsername';
atomicChange(user).profile.bio = 'Updated bio';

await session.commit();
```

## Session Lifecycle Management

Proper session management is crucial for performance and memory usage:

### Request-Response Pattern:
```typescript
// Good: Create session per request
async function handleUserRequest(userId: number) {
    const session = database.createSession();

    try {
        const user = await session.query(User).filter({ id: userId }).findOne();
        user.lastAccess = new Date();

        const orders = await session.query(Order)
            .filter({ userId: user.id })
            .find();

        await session.commit();

        return { user, orders };
    } catch (error) {
        // Session automatically rolls back on error
        throw error;
    }
    // Session is garbage collected when function exits
}
```

### Long-Running Process Pattern:
```typescript
// Good: Manage session lifecycle in long-running processes
async function processBatchData(dataItems: any[]) {
    const batchSize = 100;

    for (let i = 0; i < dataItems.length; i += batchSize) {
        const session = database.createSession();

        try {
            const batch = dataItems.slice(i, i + batchSize);

            for (const item of batch) {
                const entity = new MyEntity(item.data);
                session.add(entity);
            }

            await session.commit();
        } catch (error) {
            console.error(`Batch ${i}-${i + batchSize} failed:`, error);
            // Continue with next batch
        }

        // Session is cleaned up after each batch
    }
}
```

## Advanced Session Operations

### Bulk Operations:
```typescript
const session = database.createSession();

// Add multiple entities
const users = [
    new User('user1', 'user1@example.com'),
    new User('user2', 'user2@example.com'),
    new User('user3', 'user3@example.com')
];

users.forEach(user => session.add(user));
await session.commit(); // Single batch insert

// Remove multiple entities
const oldUsers = await session.query(User)
    .filter({ lastLogin: { $lt: oldDate } })
    .find();

oldUsers.forEach(user => session.remove(user));
await session.commit(); // Single batch delete
```

### Partial Updates:
```typescript
const session = database.createSession();

// Load only specific fields
const user = await session.query(User)
    .select('id', 'username', 'email')
    .findOne();

// Modify loaded fields
user.username = 'updated';

// Only modified fields are updated in database
await session.commit();
```

## Performance Best Practices

### When to Use Sessions:
- ✅ Multiple related database operations
- ✅ Need automatic change detection
- ✅ Working with entity relationships
- ✅ Implementing unit of work patterns
- ✅ Batch operations

### When to Use Direct Database Queries:
- ✅ Single read operations
- ✅ Simple aggregations
- ✅ Bulk updates/deletes without loading entities
- ✅ Read-only operations

### Memory Management:
```typescript
// Bad: Long-lived session accumulates entities
const globalSession = database.createSession();

async function processUser(userId: number) {
    // This accumulates users in identity map
    const user = await globalSession.query(User).findOne();
    // ... process user
}

// Good: Short-lived sessions
async function processUser(userId: number) {
    const session = database.createSession();
    const user = await session.query(User).findOne();
    // ... process user
    // Session is garbage collected
}

// Good: Manual cleanup for long-running sessions
const session = database.createSession();
try {
    // Process many entities
    for (const id of userIds) {
        const user = await session.query(User).filter({ id }).findOne();
        // ... process user
    }
} finally {
    // Clear identity map to free memory
    session.identityMap.clear();
}
```

Sessions provide an identity map that ensures there is only ever one javascript object per database entry. For example, if you run `session.query(User).find()` twice within the same session, you get two different arrays, but with the same entity instances in them.

If you add a new entity with `session.add(entity1)` and retrieve it again, you get exactly the same entity instance `entity1`.

Important: Once you start using sessions, you should use their `session.query` method instead of `database.query`. Only session queries have the identity mapping feature enabled.

## Change Detection

## Request/Response
