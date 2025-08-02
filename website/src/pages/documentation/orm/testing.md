# Testing with Deepkit ORM

Testing database-driven applications requires careful consideration of data isolation, performance, and test reliability. Deepkit ORM provides several tools and patterns to make testing easier and more effective.

## Database Adapters for Testing

### SQLite Database Adapter (Recommended)

For most testing scenarios, we recommend using `SQLiteDatabaseAdapter` with in-memory databases. This provides the best balance of performance, SQL compatibility, and feature support:

```typescript
import { SQLiteDatabaseAdapter } from '@deepkit/sqlite';
import { Database } from '@deepkit/orm';
import { entity, PrimaryKey, AutoIncrement } from '@deepkit/type';

@entity.name('user')
class User {
    id: number & PrimaryKey & AutoIncrement = 0;
    created: Date = new Date();

    constructor(public username: string, public email: string) {}
}

describe('User Service', () => {
    let database: Database;

    beforeEach(async () => {
        // Create fresh in-memory SQLite database for each test
        database = new Database(new SQLiteDatabaseAdapter(':memory:'), [User]);
        await database.migrate();
    });

    afterEach(async () => {
        await database.disconnect();
    });

    test('should create user', async () => {
        const user = new User('john', 'john@example.com');
        await database.persist(user);

        const found = await database.query(User).findOne();
        expect(found.username).toBe('john');
        expect(found.id).toBe(1);
    });
});
```

### Memory Database Adapter

The `MemoryDatabaseAdapter` is useful for simple unit tests but has limitations with complex SQL features:

```typescript
import { MemoryDatabaseAdapter } from '@deepkit/orm';
import { Database } from '@deepkit/orm';
import { entity, PrimaryKey, AutoIncrement } from '@deepkit/type';

@entity.name('user')
class User {
    id: number & PrimaryKey & AutoIncrement = 0;
    created: Date = new Date();
    
    constructor(public username: string, public email: string) {}
}

describe('User Service', () => {
    let database: Database;
    
    beforeEach(async () => {
        // Create fresh database for each test
        database = new Database(new MemoryDatabaseAdapter(), [User]);
        await database.migrate();
    });
    
    afterEach(async () => {
        // Clean up
        await database.disconnect();
    });
    
    test('should create user', async () => {
        const user = new User('john', 'john@example.com');
        await database.persist(user);
        
        const found = await database.query(User).findOne();
        expect(found.username).toBe('john');
        expect(found.id).toBe(1);
    });
    
    test('should find users by email', async () => {
        await database.persist(
            new User('john', 'john@example.com'),
            new User('jane', 'jane@example.com')
        );
        
        const user = await database.query(User)
            .filter({ email: 'jane@example.com' })
            .findOne();
            
        expect(user.username).toBe('jane');
    });
});
```

## Test Database Setup

For integration tests, you might want to use a real database. Here's a pattern for setting up test databases:

```typescript
import { SQLiteDatabaseAdapter } from '@deepkit/sqlite';
import { PostgresDatabaseAdapter } from '@deepkit/postgres';

// Test configuration
const TEST_CONFIG = {
    // Recommended: SQLite in-memory for fast, reliable tests
    sqlite: () => new SQLiteDatabaseAdapter(':memory:'),
    // For integration tests that need specific database features
    postgres: () => new PostgresDatabaseAdapter({
        host: process.env.TEST_DB_HOST || 'localhost',
        database: process.env.TEST_DB_NAME || 'test_db',
        username: process.env.TEST_DB_USER || 'test',
        password: process.env.TEST_DB_PASSWORD || 'test',
    })
};

function createTestDatabase(entities: any[], adapter: 'sqlite' | 'postgres' = 'sqlite') {
    return new Database(TEST_CONFIG[adapter](), entities);
}

describe('Integration Tests', () => {
    let database: Database;

    beforeAll(async () => {
        // Use SQLite for fast, reliable integration tests
        database = createTestDatabase([User, Order, Product], 'sqlite');
        await database.migrate();
    });

    beforeEach(async () => {
        // Clear all data before each test
        await database.query(Order).deleteMany();
        await database.query(User).deleteMany();
        await database.query(Product).deleteMany();
    });

    afterAll(async () => {
        await database.disconnect();
    });
});
```

## Testing with Sessions

When testing code that uses sessions, ensure proper session management:

```typescript
describe('Session-based operations', () => {
    let database: Database;

    beforeEach(async () => {
        database = new Database(new SQLiteDatabaseAdapter(':memory:'), [User]);
        await database.migrate();
    });
    
    test('should track changes in session', async () => {
        const session = database.createSession();
        
        // Add new user
        const user = new User('john', 'john@example.com');
        session.add(user);
        
        // Modify existing user
        const existingUser = await session.query(User).findOneOrUndefined();
        if (existingUser) {
            existingUser.username = 'john_updated';
        }
        
        // Commit all changes
        await session.commit();
        
        // Verify changes
        const updated = await database.query(User).findOne();
        expect(updated.username).toBe('john_updated');
    });
    
    test('should rollback on error', async () => {
        const session = database.createSession();
        
        try {
            session.add(new User('john', 'john@example.com'));
            
            // Simulate error
            throw new Error('Something went wrong');
            
            await session.commit();
        } catch (error) {
            // Session automatically rolls back on error
        }
        
        // Verify no data was persisted
        const count = await database.query(User).count();
        expect(count).toBe(0);
    });
});
```

## Testing Transactions

Test transaction behavior to ensure data consistency:

```typescript
describe('Transaction tests', () => {
    test('should rollback on transaction failure', async () => {
        const database = new Database(new SQLiteDatabaseAdapter(':memory:'), [User, Order]);
        await database.migrate();
        
        const session = database.createSession();
        
        try {
            await session.transaction(async () => {
                // Add user
                const user = new User('john', 'john@example.com');
                session.add(user);
                await session.flush(); // Persist user to get ID
                
                // Add order
                const order = new Order(user.id, 100.00);
                session.add(order);
                
                // Simulate error that should rollback everything
                if (order.amount > 50) {
                    throw new Error('Order amount too high');
                }
            });
        } catch (error) {
            // Transaction rolled back
        }
        
        // Verify nothing was persisted
        expect(await database.query(User).count()).toBe(0);
        expect(await database.query(Order).count()).toBe(0);
    });
});
```

## Testing with Fixtures

Create reusable test data fixtures:

```typescript
class TestFixtures {
    static async createUsers(database: Database, count: number = 3): Promise<User[]> {
        const users = [];
        for (let i = 1; i <= count; i++) {
            users.push(new User(`user${i}`, `user${i}@example.com`));
        }
        await database.persist(...users);
        return users;
    }
    
    static async createCompleteOrderScenario(database: Database) {
        const users = await this.createUsers(database, 2);
        
        const products = [
            new Product('Laptop', 999.99, 'electronics'),
            new Product('Book', 19.99, 'books'),
        ];
        await database.persist(...products);
        
        const orders = [
            new Order(users[0].id, products[0].id, 1),
            new Order(users[1].id, products[1].id, 2),
        ];
        await database.persist(...orders);
        
        return { users, products, orders };
    }
}

describe('E-commerce tests', () => {
    let database: Database;

    beforeEach(async () => {
        database = new Database(new SQLiteDatabaseAdapter(':memory:'), [User, Product, Order]);
        await database.migrate();
    });
    
    test('should calculate total revenue', async () => {
        const { orders } = await TestFixtures.createCompleteOrderScenario(database);
        
        const revenue = await database.query(Order)
            .withSum('amount', 'total')
            .findOne();
            
        expect(revenue.total).toBeGreaterThan(0);
    });
});
```

## Performance Testing

Test query performance and identify bottlenecks:

```typescript
describe('Performance tests', () => {
    test('should handle large datasets efficiently', async () => {
        const database = new Database(new SQLiteDatabaseAdapter(':memory:'), [User]);
        await database.migrate();
        
        // Create large dataset
        const users = [];
        for (let i = 0; i < 10000; i++) {
            users.push(new User(`user${i}`, `user${i}@example.com`));
        }
        
        const startTime = Date.now();
        await database.persist(...users);
        const insertTime = Date.now() - startTime;
        
        expect(insertTime).toBeLessThan(5000); // Should complete in under 5 seconds
        
        // Test query performance
        const queryStart = Date.now();
        const found = await database.query(User)
            .filter({ username: { $regex: /user1.*/ } })
            .limit(100)
            .find();
        const queryTime = Date.now() - queryStart;
        
        expect(queryTime).toBeLessThan(1000); // Should complete in under 1 second
        expect(found.length).toBeGreaterThan(0);
    });
});
```

## Best Practices

1. **Isolation**: Each test should be independent and not rely on data from other tests
2. **Clean State**: Always start with a clean database state
3. **SQLite for Testing**: Use `SQLiteDatabaseAdapter` with `:memory:` for most tests - it's fast and supports full SQL features
4. **Memory Adapter**: Use `MemoryDatabaseAdapter` only for simple unit tests that don't need complex SQL features
5. **Real Database**: Use production database adapters for integration tests that need specific database features
6. **Fixtures**: Create reusable test data generators
7. **Transactions**: Test both success and failure scenarios
8. **Performance**: Include performance tests for critical queries
9. **Cleanup**: Always disconnect from databases in test teardown
