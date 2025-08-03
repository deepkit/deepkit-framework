# Events

Events provide a powerful way to hook into Deepkit ORM's lifecycle and implement cross-cutting concerns like auditing, caching, validation, and authorization. They allow you to execute custom logic at specific points during database operations without modifying your core business logic.

## Understanding ORM Events

Events in Deepkit ORM are fired at key moments during database operations, allowing you to:
- **Audit changes**: Track who modified what and when
- **Implement caching**: Cache frequently accessed data
- **Add authorization**: Check permissions before operations
- **Validate data**: Perform complex validation beyond type constraints
- **Transform data**: Modify data before saving or after loading
- **Integrate external systems**: Sync with search engines, message queues, etc.

## Event Categories

There are two main categories of events:

1. **Query Events**: Triggered during direct database queries (`Database.query()`)
2. **Unit-of-Work Events**: Triggered during session operations (`Session.commit()`)

## Event Registration

Events can be registered at the database level (global) or session level (scoped):

```typescript
import { Query, Database } from '@deepkit/orm';

const database = new Database(...);

// Global event listener - applies to all operations
database.listen(Query.onFetch, async (event) => {
    console.log('Data fetched:', event.classSchema.name);
});

const session = database.createSession();

// Session-scoped event listener - only for this session
session.eventDispatcher.listen(Query.onFetch, async (event) => {
    console.log('Session-specific fetch');
});
```

### Event Listener Lifecycle

```typescript
// Register an event listener
const unsubscribe = database.listen(Query.onFetch, async (event) => {
    // Your event handling logic
});

// Unregister when no longer needed
unsubscribe();
```

## Query Events

Query events are triggered when operations are executed via `Database.query()` or `Session.query()`. These events allow you to intercept and modify queries before they're executed, or process results after they're returned.

### Query Event Capabilities

- **Modify queries**: Add filters, change ordering, or alter the query structure
- **Access metadata**: Get information about the entity type and operation
- **Transform results**: Modify data after it's fetched from the database
- **Implement security**: Add row-level security filters
- **Add logging**: Track query execution for debugging or auditing

### Basic Query Event Usage

```typescript
import { Query, Database } from '@deepkit/orm';

const database = new Database(...);

// Intercept fetch operations
const unsubscribe = database.listen(Query.onFetch, async (event) => {
    console.log(`Fetching ${event.classSchema.name} entities`);

    // Add a filter to all queries for this entity
    if (event.classSchema.name === 'user') {
        event.query = event.query.filter({ active: true });
    }
});

// Clean up when done
unsubscribe();
```

### Practical Example: Soft Delete Implementation

```typescript
// Automatically filter out deleted records
database.listen(Query.onFetch, async (event) => {
    // Add deleted filter to all entities that have a 'deletedAt' field
    if (event.classSchema.hasProperty('deletedAt')) {
        event.query = event.query.filter({ deletedAt: null });
    }
});

// Automatically set deletedAt instead of actually deleting
database.listen(Query.onDeletePre, async (event) => {
    if (event.classSchema.hasProperty('deletedAt')) {
        // Convert delete to update
        event.query = event.query.patchMany({ deletedAt: new Date() });
    }
});
```

### Available Query Events

| Event-Token        | Description                                                 |
|--------------------|-------------------------------------------------------------|
| Query.onFetch      | When objects where fetched via find()/findOne()/etc         |
| Query.onDeletePre  | Before objects are deleted via deleteMany/deleteOne()       |
| Query.onDeletePost | After objects are deleted via deleteMany/deleteOne()        |
| Query.onPatchPre   | Before objects are updated via patchOne/patchMany()         |
| Query.onPatchPost  | After objects are updated via patchOne/patchMany()          |

## Unit of Work Events

Unit of Work events are triggered during session operations and provide hooks into the persistence lifecycle:

```typescript
import { DatabaseSession } from '@deepkit/orm';

const database = new Database(...);

// Listen to session events
database.listen(DatabaseSession.onInsertPre, async (event) => {
    console.log('About to insert:', event.items.length, 'items');

    // Modify items before insertion
    for (const item of event.items) {
        if (item instanceof User) {
            item.createdAt = new Date();
        }
    }
});

database.listen(DatabaseSession.onUpdatePre, async (event) => {
    console.log('About to update:', event.changeSets.length, 'items');

    // Add automatic timestamp updates
    for (const changeSet of event.changeSets) {
        if (changeSet.item instanceof User) {
            changeSet.changes.set('updatedAt', new Date());
        }
    }
});
```

### Available Unit of Work Events:

| Event-Token                    | Description                                    |
|--------------------------------|------------------------------------------------|
| DatabaseSession.onInsertPre    | Before entities are inserted                   |
| DatabaseSession.onInsertPost   | After entities are inserted                    |
| DatabaseSession.onUpdatePre    | Before entities are updated                    |
| DatabaseSession.onUpdatePost   | After entities are updated                     |
| DatabaseSession.onDeletePre    | Before entities are deleted                    |
| DatabaseSession.onDeletePost   | After entities are deleted                     |

## Building Plugins

Events are the foundation for building powerful plugins. Here's how to create reusable plugins:

### Timestamp Plugin

```typescript
import { Database, DatabaseSession } from '@deepkit/orm';
import { t, Data } from '@deepkit/type';

// Decorator to mark timestamp fields
function timestamp(type: 'created' | 'updated' | 'both' = 'both') {
    return t.data('timestamp', type);
}

class TimestampPlugin {
    static register(database: Database) {
        // Handle creation timestamps
        database.listen(DatabaseSession.onInsertPre, (event) => {
            for (const item of event.items) {
                const schema = event.classSchema;
                for (const property of schema.getProperties()) {
                    const timestampType = property.getData()['timestamp'];
                    if (timestampType === 'created' || timestampType === 'both') {
                        (item as any)[property.name] = new Date();
                    }
                }
            }
        });

        // Handle update timestamps
        database.listen(DatabaseSession.onUpdatePre, (event) => {
            for (const changeSet of event.changeSets) {
                const schema = event.classSchema;
                for (const property of schema.getProperties()) {
                    const timestampType = property.getData()['timestamp'];
                    if (timestampType === 'updated' || timestampType === 'both') {
                        changeSet.changes.set(property.name, new Date());
                    }
                }
            }
        });
    }
}

// Usage with decorator
@entity.name('post')
class Post {
    id: number & PrimaryKey & AutoIncrement = 0;

    @timestamp('created')
    createdAt: Date = new Date();

    @timestamp('updated')
    updatedAt: Date = new Date();

    constructor(public title: string, public content: string) {}
}

// Alternative usage with type annotations
@entity.name('article')
class Article {
    id: number & PrimaryKey & AutoIncrement = 0;

    // Using Data type annotation directly
    createdAt: Date & Data<'timestamp', 'created'> = new Date();
    updatedAt: Date & Data<'timestamp', 'updated'> = new Date();

    constructor(public title: string, public content: string) {}
}

const database = new Database(...);
TimestampPlugin.register(database);
```

### Audit Trail Plugin

Create an audit trail that tracks all changes to entities:

```typescript
@entity.name('audit_log')
class AuditLog {
    id: number & PrimaryKey & AutoIncrement = 0;
    entityType: string = '';
    entityId: string = '';
    operation: 'INSERT' | 'UPDATE' | 'DELETE' = 'INSERT';
    changes: Record<string, any> = {};
    userId?: number;
    timestamp: Date = new Date();
}

class AuditPlugin {
    constructor(private getCurrentUserId: () => number | undefined) {}

    register(database: Database) {
        // Track inserts
        database.listen(DatabaseSession.onInsertPost, async (event) => {
            const auditLogs = event.items.map(item => new AuditLog());

            for (let i = 0; i < event.items.length; i++) {
                const item = event.items[i];
                const log = auditLogs[i];

                log.entityType = event.classSchema.name;
                log.entityId = String((item as any).id);
                log.operation = 'INSERT';
                log.changes = { ...item };
                log.userId = this.getCurrentUserId();
            }

            await database.persist(...auditLogs);
        });

        // Track updates
        database.listen(DatabaseSession.onUpdatePost, async (event) => {
            const auditLogs = event.changeSets.map(() => new AuditLog());

            for (let i = 0; i < event.changeSets.length; i++) {
                const changeSet = event.changeSets[i];
                const log = auditLogs[i];

                log.entityType = event.classSchema.name || 'unknown';
                log.entityId = String(changeSet.primaryKey);
                log.operation = 'UPDATE';
                log.changes = Object.fromEntries(changeSet.changes);
                log.userId = this.getCurrentUserId();
            }

            await database.persist(...auditLogs);
        });

        // Track deletes
        database.listen(DatabaseSession.onDeletePost, async (event) => {
            const auditLogs = event.items.map(() => new AuditLog());

            for (let i = 0; i < event.items.length; i++) {
                const item = event.items[i];
                const log = auditLogs[i];

                log.entityType = event.classSchema.name;
                log.entityId = String((item as any).id);
                log.operation = 'DELETE';
                log.changes = { ...item };
                log.userId = this.getCurrentUserId();
            }

            await database.persist(...auditLogs);
        });
    }
}

// Usage
const auditPlugin = new AuditPlugin(() => getCurrentUser()?.id);
auditPlugin.register(database);
```

### Validation Plugin

Add custom validation logic that runs before database operations:

```typescript
class ValidationPlugin {
    static register(database: Database) {
        database.listen(DatabaseSession.onInsertPre, async (event) => {
            for (const item of event.items) {
                await this.validateEntity(item, event.classSchema);
            }
        });

        database.listen(DatabaseSession.onUpdatePre, async (event) => {
            for (const changeSet of event.changeSets) {
                // Create a temporary object with applied changes for validation
                const tempItem = { ...changeSet.item };
                for (const [key, value] of changeSet.changes) {
                    (tempItem as any)[key] = value;
                }
                await this.validateEntity(tempItem, event.classSchema);
            }
        });
    }

    private static async validateEntity(item: any, schema: ReflectionClass<any>) {
        // Custom business logic validation
        if (item instanceof User) {
            // Check if email is already taken
            const existingUser = await database.query(User)
                .filter({ email: item.email })
                .filter({ id: { $ne: item.id } })
                .findOneOrUndefined();

            if (existingUser) {
                throw new Error(`Email ${item.email} is already taken`);
            }

            // Validate age requirements
            if (item.age < 13) {
                throw new Error('Users must be at least 13 years old');
            }
        }
    }
}

ValidationPlugin.register(database);
```

## Error Handling in Events

Handle errors gracefully in event listeners:

```typescript
import { onDatabaseError } from '@deepkit/orm';

// Global error handler
database.listen(onDatabaseError, (event) => {
    console.error('Database error:', event.error);

    if (event instanceof DatabaseErrorInsertEvent) {
        console.error('Failed to insert:', event.items);
    } else if (event instanceof DatabaseErrorUpdateEvent) {
        console.error('Failed to update:', event.changeSets);
    }

    // Log to external service
    logToExternalService(event.error, event);
});

// Specific error handling in plugins
class RobustPlugin {
    static register(database: Database) {
        database.listen(DatabaseSession.onInsertPre, async (event) => {
            try {
                // Plugin logic here
                await this.processItems(event.items);
            } catch (error) {
                console.error('Plugin error during insert:', error);
                // Decide whether to throw (abort operation) or continue
                // throw error; // Abort the operation
                // or log and continue
            }
        });
    }
}
```

## Performance Considerations

When working with events, consider performance implications:

```typescript
class PerformantPlugin {
    static register(database: Database) {
        // Batch operations when possible
        database.listen(DatabaseSession.onInsertPost, async (event) => {
            if (event.items.length > 100) {
                // Process in batches for large operations
                const batchSize = 50;
                for (let i = 0; i < event.items.length; i += batchSize) {
                    const batch = event.items.slice(i, i + batchSize);
                    await this.processBatch(batch);
                }
            } else {
                await this.processItems(event.items);
            }
        });

        // Use async operations carefully
        database.listen(DatabaseSession.onUpdatePre, async (event) => {
            // Avoid blocking the main operation with slow async calls
            // Consider using background jobs for heavy processing
            setImmediate(async () => {
                await this.heavyProcessing(event.changeSets);
            });
        });
    }
}
```
| Query.onDeletePost | After objects are deleted via deleteMany/deleteOne()        |
| Query.onPatchPre   | Before objects are patched/updated via patchMany/patchOne() |
| Query.onPatchPost  | After objects are patched/updated via patchMany/patchOne()  |

## Unit Of Work Events

Unit-of-work events are triggered when a new session submits changes.

| Event-Token                  | Description                                                                                                       |
|------------------------------|-------------------------------------------------------------------------------------------------------------------|
| DatabaseSession.onUpdatePre  | Triggered just before the `DatabaseSession` object initiates an update operation on the database records.         |
| DatabaseSession.onUpdatePost | Triggered immediately after the `DatabaseSession` object has successfully completed the update operation.         |
| DatabaseSession.onInsertPre  | Triggered just before the `DatabaseSession` object starts the insertion of new records into the database.         |
| DatabaseSession.onInsertPost | Triggered immediately after the `DatabaseSession` object has successfully inserted the new records.               |
| DatabaseSession.onDeletePre  | Triggered just before the `DatabaseSession` object begins a delete operation to remove records from the database. |
| DatabaseSession.onDeletePost | Triggered immediately after the `DatabaseSession` object has completed the delete operation.                      |
| DatabaseSession.onCommitPre  | Triggered just before the `DatabaseSession` object commits any changes made during the session to the database.   |
