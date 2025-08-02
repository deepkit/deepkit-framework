# Performance Best Practices

Optimizing database performance is crucial for scalable applications. Deepkit ORM provides several features and patterns to help you build high-performance database operations.

## Session vs Database Queries

Understanding when to use sessions versus direct database queries is fundamental for performance:

### Use Sessions When:
- Performing multiple related operations
- Need change tracking and automatic updates
- Working with entity relationships
- Implementing unit of work patterns

```typescript
// Good: Use session for multiple operations
const session = database.createSession();

const user = await session.query(User).findOne();
user.lastLogin = new Date();

const order = new Order(user.id, 99.99);
session.add(order);

// Single commit for all changes
await session.commit();
```

### Use Direct Database Queries When:
- Performing single operations
- Read-only queries
- Bulk operations
- Simple aggregations

```typescript
// Good: Direct query for simple read operations
const users = await database.query(User)
    .filter({ active: true })
    .limit(10)
    .find();

// Good: Direct query for bulk operations
await database.query(User)
    .filter({ lastLogin: { $lt: oldDate } })
    .patchMany({ active: false });
```

## Identity Map and Change Detection

The identity map prevents duplicate entity instances and enables automatic change detection:

```typescript
const session = database.createSession();

// First query loads user into identity map
const user1 = await session.query(User).filter({ id: 1 }).findOne();

// Second query returns same instance from identity map (no database hit)
const user2 = await session.query(User).filter({ id: 1 }).findOne();

console.log(user1 === user2); // true

// Changes are automatically tracked
user1.username = 'updated';
await session.commit(); // Automatically generates UPDATE statement
```

### Identity Map Best Practices:
- Use sessions for related operations to benefit from identity map
- Be aware that sessions hold references to entities (memory usage)
- Create new sessions for different logical units of work
- Don't keep sessions alive too long in long-running processes

## Batch Operations

Batch operations are significantly more efficient than individual operations:

```typescript
// Bad: Individual inserts
for (const userData of userDataArray) {
    await database.persist(new User(userData.name, userData.email));
}

// Good: Batch insert
const users = userDataArray.map(data => new User(data.name, data.email));
await database.persist(...users);

// Good: Batch insert with session
const session = database.createSession();
users.forEach(user => session.add(user));
await session.commit();
```

## Query Optimization

### Select Only Required Fields
```typescript
// Bad: Select all fields
const users = await database.query(User).find();

// Good: Select only needed fields
const usernames = await database.query(User)
    .select('username', 'email')
    .find();
```

### Use Proper Filtering
```typescript
// Bad: Load all data then filter in application
const allUsers = await database.query(User).find();
const activeUsers = allUsers.filter(u => u.active);

// Good: Filter in database
const activeUsers = await database.query(User)
    .filter({ active: true })
    .find();
```

### Limit Result Sets
```typescript
// Always use limit for potentially large result sets
const recentUsers = await database.query(User)
    .orderBy('created', 'desc')
    .limit(50)
    .find();

// Use pagination for large datasets
const page = await database.query(User)
    .orderBy('id')
    .skip(page * pageSize)
    .limit(pageSize)
    .find();
```

## Indexing Strategy

Proper indexing is crucial for query performance:

```typescript
import { Index, Unique } from '@deepkit/type';

@entity.name('user')
class User {
    id: number & PrimaryKey & AutoIncrement = 0;

    // Single field index
    email: string & Index = '';

    // Index with options
    status: 'active' | 'inactive' & Index<{ name: 'status_idx' }> = 'active';

    // Unique index (automatically creates index)
    username: string & Unique = '';

    created: Date = new Date();
}

// Compound indexes are defined at the entity level
@entity.name('order')
    .index(['customerId', 'status'])  // Compound index
    .index(['createdAt'], { name: 'created_idx' })  // Named index
class Order {
    id: number & PrimaryKey & AutoIncrement = 0;
    customerId: number = 0;
    status: 'pending' | 'completed' | 'cancelled' = 'pending';
    createdAt: Date = new Date();
}
```

### Index Guidelines:
- Index fields used in WHERE clauses
- Index fields used in ORDER BY clauses
- Index foreign key fields
- Consider compound indexes for multi-field queries
- Don't over-index (impacts write performance)

## Relationship Loading

Control how relationships are loaded to optimize performance:

```typescript
@entity.name('user')
class User {
    id: number & PrimaryKey & AutoIncrement = 0;
    username: string = '';
    orders: Order[] & BackReference = [];
}

@entity.name('order')
class Order {
    id: number & PrimaryKey & AutoIncrement = 0;
    user: User & Reference = new User();
    amount: number = 0;
}

// Lazy loading (default) - loads relationships on access
const user = await database.query(User).findOne();
const orders = await user.orders; // Separate query

// Eager loading - loads relationships upfront
const usersWithOrders = await database.query(User)
    .joinWith('orders')
    .find();

// Select specific relationship fields
const usersWithOrderCounts = await database.query(User)
    .joinWith('orders')
    .select('username', 'orders.amount')
    .find();
```

## Connection Pooling

For production applications, configure connection pooling:

```typescript
import { PostgresDatabaseAdapter } from '@deepkit/postgres';

const database = new Database(new PostgresDatabaseAdapter({
    host: 'localhost',
    database: 'myapp',
    username: 'user',
    password: 'password',
    // Connection pool settings
    connectionLimit: 10,
    acquireTimeout: 60000,
    timeout: 60000,
}));
```

## Monitoring and Debugging

Use built-in tools to monitor performance:

```typescript
import { Logger } from '@deepkit/logger';

// Enable query logging
const logger = new Logger();
database.adapter.setLogger(logger);

// Log slow queries
database.listen(Query.onFetch, (event) => {
    const startTime = Date.now();
    
    event.query.onExecuted.subscribe(() => {
        const duration = Date.now() - startTime;
        if (duration > 1000) { // Log queries taking > 1 second
            logger.warning(`Slow query detected: ${duration}ms`);
        }
    });
});
```

## Memory Management

Prevent memory leaks in long-running applications:

```typescript
// Bad: Keeping session alive too long
const globalSession = database.createSession();

// Good: Create sessions per request/operation
async function handleRequest() {
    const session = database.createSession();
    try {
        // Perform operations
        const result = await session.query(User).find();
        return result;
    } finally {
        // Session will be garbage collected
    }
}

// Good: Explicit cleanup for long-running processes
const session = database.createSession();
try {
    // Perform batch operations
    await processBatchData(session);
} finally {
    // Clear identity map to free memory
    session.identityMap.clear();
}
```

## Aggregation Performance

Use database-level aggregation instead of application-level calculations:

```typescript
// Bad: Load all data and calculate in application
const orders = await database.query(Order).find();
const totalRevenue = orders.reduce((sum, order) => sum + order.amount, 0);

// Good: Use database aggregation
const result = await database.query(Order)
    .withSum('amount', 'totalRevenue')
    .findOne();
const totalRevenue = result.totalRevenue;

// Good: Aggregation with grouping
const revenueByMonth = await database.query(Order)
    .groupBy('YEAR(created)', 'MONTH(created)')
    .withSum('amount', 'revenue')
    .withCount('id', 'orderCount')
    .find();
```

## Performance Testing

Include performance tests in your test suite:

```typescript
describe('Performance tests', () => {
    test('bulk insert performance', async () => {
        const users = Array.from({ length: 10000 }, (_, i) => 
            new User(`user${i}`, `user${i}@example.com`)
        );
        
        const startTime = Date.now();
        await database.persist(...users);
        const duration = Date.now() - startTime;
        
        expect(duration).toBeLessThan(5000); // Should complete in under 5 seconds
    });
    
    test('query performance with large dataset', async () => {
        // Setup large dataset...
        
        const startTime = Date.now();
        const results = await database.query(User)
            .filter({ active: true })
            .orderBy('created', 'desc')
            .limit(100)
            .find();
        const duration = Date.now() - startTime;
        
        expect(duration).toBeLessThan(1000); // Should complete in under 1 second
        expect(results.length).toBeLessThanOrEqual(100);
    });
});
```
