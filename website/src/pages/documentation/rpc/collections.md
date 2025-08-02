# Collections

Deepkit RPC provides a powerful `Collection` class for managing lists of entities with built-in state synchronization, pagination, and real-time updates. Collections are particularly useful for managing data sets that need to be kept in sync between client and server.

## Basic Usage

```typescript
import { Collection } from '@deepkit/rpc';
import { entity } from '@deepkit/type';

@entity.name('user')
class User {
    constructor(
        public id: number,
        public name: string,
        public email: string
    ) {}
}

@rpc.controller('/users')
class UserController {
    private users = new Collection(User);

    constructor() {
        // Initialize with some data
        this.users.set([
            new User(1, 'Alice', 'alice@example.com'),
            new User(2, 'Bob', 'bob@example.com'),
            new User(3, 'Charlie', 'charlie@example.com')
        ]);
        this.users.state.total = 100; // Total items available
    }

    @rpc.action()
    getUsers(): Collection<User> {
        return this.users;
    }

    @rpc.action()
    addUser(user: User): void {
        this.users.add(user);
    }

    @rpc.action()
    removeUser(id: number): void {
        this.users.remove(id);
    }

    @rpc.action()
    updateUser(user: User): void {
        this.users.add(user); // Adding with same ID updates the item
    }
}
```

Client usage:

```typescript
const controller = client.controller<UserController>('/users');

// Get the collection
const users = await controller.getUsers();

console.log('Total users:', users.count());
console.log('All users:', users.all());
console.log('User by ID:', users.get(1));

// Check if user exists
if (users.has(2)) {
    console.log('User 2 exists');
}

// Get user index
const userIndex = users.index(users.get(1)!);
console.log('User 1 is at index:', userIndex);
```

## Collection State

Collections maintain state information for pagination and metadata:

```typescript
@rpc.controller('/products')
class ProductController {
    @rpc.action()
    getProducts(page: number = 0, limit: number = 10): Collection<Product> {
        const collection = new Collection(Product);
        
        // Configure pagination
        collection.model.itemsPerPage = limit;
        collection.model.skip = page * limit;
        collection.model.limit = limit;
        collection.model.sort = { name: 'asc' };
        
        // Set the actual data for this page
        const products = this.getProductsFromDatabase(page, limit);
        collection.set(products);
        
        // Set total count
        collection.state.total = this.getTotalProductCount();
        
        return collection;
    }
}
```

Client pagination:

```typescript
const products = await controller.getProducts(0, 10);

console.log('Items per page:', products.model.itemsPerPage);
console.log('Current page items:', products.count());
console.log('Total items:', products.state.total);
console.log('Current skip:', products.model.skip);

// Calculate pagination info
const totalPages = Math.ceil(products.state.total / products.model.itemsPerPage);
const currentPage = Math.floor(products.model.skip / products.model.itemsPerPage);

console.log(`Page ${currentPage + 1} of ${totalPages}`);
```

## Real-time Updates

Collections can be used with streaming to provide real-time updates:

```typescript
import { Subject } from 'rxjs';

@rpc.controller('/live-data')
class LiveDataController {
    private collection = new Collection(DataItem);
    private updates = new Subject<Collection<DataItem>>();

    constructor() {
        // Simulate real-time data updates
        setInterval(() => {
            const newItem = new DataItem(
                Date.now(),
                `Item ${Date.now()}`,
                Math.random()
            );
            this.collection.add(newItem);
            this.updates.next(this.collection);
        }, 2000);
    }

    @rpc.action()
    getInitialData(): Collection<DataItem> {
        return this.collection;
    }

    @rpc.action()
    subscribeToUpdates(): Subject<Collection<DataItem>> {
        return this.updates;
    }

    @rpc.action()
    addItem(item: DataItem): void {
        this.collection.add(item);
        this.updates.next(this.collection);
    }

    @rpc.action()
    removeItem(id: number): void {
        this.collection.remove(id);
        this.updates.next(this.collection);
    }
}

@entity.name('data-item')
class DataItem {
    constructor(
        public id: number,
        public name: string,
        public value: number
    ) {}
}
```

Client real-time updates:

```typescript
const controller = client.controller<LiveDataController>('/live-data');

// Get initial data
let collection = await controller.getInitialData();
console.log('Initial items:', collection.count());

// Subscribe to updates
const updates = await controller.subscribeToUpdates();
updates.subscribe(updatedCollection => {
    collection = updatedCollection;
    console.log('Updated items:', collection.count());
    console.log('Latest item:', collection.all()[collection.count() - 1]);
});

// Add new items
await controller.addItem(new DataItem(999, 'Manual Item', 42));
```

## Collection Methods

The Collection class provides many useful methods:

```typescript
const collection = new Collection(User);

// Adding items
collection.add(new User(1, 'Alice', 'alice@example.com'));
collection.set([
    new User(2, 'Bob', 'bob@example.com'),
    new User(3, 'Charlie', 'charlie@example.com')
]);

// Accessing items
const user = collection.get(1);           // Get by ID
const allUsers = collection.all();        // Get all items
const userIds = collection.ids();         // Get all IDs
const userMap = collection.map();         // Get as Map<ID, Item>

// Checking existence
const exists = collection.has(1);         // Check if ID exists
const isEmpty = collection.empty();       // Check if empty
const count = collection.count();         // Get item count

// Finding items
const index = collection.index(user);     // Get index of item
const page = collection.getPageOf(user, 10); // Get page number for item

// Modifying
collection.remove(1);                     // Remove by ID
collection.reset();                       // Clear all items
```

## Filtering and Sorting

Collections support client-side filtering and sorting:

```typescript
@rpc.controller('/inventory')
class InventoryController {
    @rpc.action()
    getInventory(): Collection<InventoryItem> {
        const collection = new Collection(InventoryItem);
        
        // Set sorting configuration
        collection.model.sort = { name: 'asc', price: 'desc' };
        
        const items = [
            new InventoryItem(1, 'Laptop', 999.99, 'Electronics'),
            new InventoryItem(2, 'Mouse', 29.99, 'Electronics'),
            new InventoryItem(3, 'Desk', 199.99, 'Furniture')
        ];
        
        collection.set(items);
        return collection;
    }
}

@entity.name('inventory-item')
class InventoryItem {
    constructor(
        public id: number,
        public name: string,
        public price: number,
        public category: string
    ) {}
}
```

Client-side filtering:

```typescript
const inventory = await controller.getInventory();

// Filter items client-side
const electronics = inventory.all().filter(item => item.category === 'Electronics');
const expensiveItems = inventory.all().filter(item => item.price > 100);

console.log('Electronics:', electronics);
console.log('Expensive items:', expensiveItems);

// Sort configuration is available
console.log('Sort order:', inventory.model.sort);
```

## Entity State Management

Collections work seamlessly with entity state management for tracking changes:

```typescript
import { EntityState } from '@deepkit/rpc';

@rpc.controller('/tasks')
class TaskController {
    private tasks = new Collection(Task);

    @rpc.action()
    getTasks(): Collection<Task> {
        return this.tasks;
    }

    @rpc.action()
    getTaskState(): EntityState<Task> {
        // Return entity state for change tracking
        return new EntityState(Task);
    }
}

@entity.name('task')
class Task {
    constructor(
        public id: number,
        public title: string,
        public completed: boolean = false
    ) {}
}
```

## Performance Considerations

- Collections are optimized for frequent updates and lookups
- Large collections are automatically chunked during transmission
- Use pagination for very large datasets
- Consider using streaming updates for real-time scenarios
- Entity state tracking helps minimize data transfer

## Type Safety

Collections maintain full type safety:

```typescript
// TypeScript knows the exact type
const userCollection: Collection<User> = await controller.getUsers();

// All methods are type-safe
const user: User | undefined = userCollection.get(1);
const users: User[] = userCollection.all();
const userMap: Map<number, User> = userCollection.map();
```
