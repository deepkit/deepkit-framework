
# Query

A query is an object that describes how to retrieve or modify data from the database. It provides a fluent API that allows you to build complex database operations in a type-safe manner. The query builder pattern ensures that your queries are constructed correctly at compile time, reducing runtime errors.

## Query Creation and Execution

You can create a query using `Database.query(T)` or `Session.query(T)`. We strongly recommend using Sessions as they provide significant performance benefits through identity mapping and automatic change detection.

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

// Direct database query (basic approach)
const users = await database.query(User).select('username').find();
// Result: [{ username: 'User1' }, { username: 'User2' }, { username: 'User3' }]

// Using session (recommended for better performance and change tracking)
const session = database.createSession();
const users = await session.query(User).select('username').find();
```

### Why Use Sessions?

Sessions provide several advantages:
- **Identity Map**: Ensures the same entity instance is returned for the same database record
- **Change Detection**: Automatically tracks modifications to loaded entities
- **Performance**: Reduces database round trips by caching entities
- **Consistency**: Maintains object identity across multiple queries

## Query Building Pattern

Queries in Deepkit ORM follow a builder pattern where you chain methods to construct your query, then call a termination method to execute it:

```typescript
const result = await database.query(User)
    .filter({ visits: { $gt: 10 } })    // Add conditions
    .orderBy('created', 'desc')         // Sort results
    .limit(20)                          // Limit results
    .find();                            // Execute query (termination method)
```

**Termination methods** execute the query and return results:
- `find()` - Returns array of entities
- `findOne()` - Returns single entity (throws if not found)
- `findOneOrUndefined()` - Returns single entity or undefined
- `count()` - Returns number of matching records
- `has()` - Returns boolean indicating if any records exist

## Filter

Filters allow you to specify conditions that limit which records are returned from the database. Deepkit ORM provides a comprehensive filtering system that supports simple equality checks, range queries, pattern matching, and complex logical operations.

### Basic Equality Filters

The simplest filters check for exact matches:

```typescript
// Single condition - finds users with exact username
const users = await database.query(User).filter({ username: 'User1' }).find();

// Multiple conditions (implicit AND) - both conditions must be true
const users = await database.query(User).filter({ username: 'User1', visits: 5 }).find();
// SQL equivalent: WHERE username = 'User1' AND visits = 5
```

### Range Filters

Use comparison operators to filter by ranges:

```typescript
// Greater than operators
const activeUsers = await database.query(User).filter({ visits: { $gt: 10 } }).find();
const recentUsers = await database.query(User).filter({ created: { $gte: new Date('2023-01-01') } }).find();

// Less than operators
const newUsers = await database.query(User).filter({ visits: { $lt: 5 } }).find();
const oldUsers = await database.query(User).filter({ created: { $lte: new Date('2022-12-31') } }).find();

// Combining range conditions
const moderateUsers = await database.query(User).filter({
    visits: { $gte: 5, $lt: 20 }  // Between 5 and 19 visits
}).find();
```

**Range Operators:**
- `$gt` - Greater than
- `$gte` - Greater than or equal
- `$lt` - Less than
- `$lte` - Less than or equal

### Set-based Filters

Filter by checking if values are in a specific set:

```typescript
// Include specific values
const specificUsers = await database.query(User).filter({
    id: { $in: [1, 2, 3, 5, 8] }
}).find();

// Exclude specific values
const excludedUsers = await database.query(User).filter({
    username: { $nin: ['admin', 'test', 'guest'] }
}).find();
```

### Pattern Matching

Use regular expressions for flexible text matching:

```typescript
// Find usernames matching a pattern
const numberedUsers = await database.query(User).filter({
    username: { $regex: /^User\d+$/ }  // Matches User1, User2, etc.
}).find();

// Case-insensitive search
const emailPattern = await database.query(User).filter({
    email: { $regex: /gmail\.com$/i }
}).find();
```

### Logical Grouping

Combine multiple conditions with logical operators:

```typescript
// OR condition - either condition can be true
const users = await database.query(User).filter({
    $or: [
        { username: 'User1' },
        { username: 'User2' }
    ]
}).find();

// Complex nested conditions
const complexFilter = await database.query(User).filter({
    $and: [
        { visits: { $gt: 0 } },  // Must have visits
        {
            $or: [
                { username: { $regex: /^Admin/ } },  // Admin users
                { created: { $gte: new Date('2023-01-01') } }  // Or recent users
            ]
        }
    ]
}).find();
```

**Logical Operators:**
- `$and` - All conditions must be true (default behavior)
- `$or` - At least one condition must be true
- `$nor` - None of the conditions can be true

### Filter Chaining

You can chain multiple filter calls, which creates an implicit AND relationship:

```typescript
const users = await database.query(User)
    .filter({ visits: { $gt: 5 } })      // First condition
    .filter({ created: { $gte: new Date('2023-01-01') } })  // AND second condition
    .find();
```

## Select

The `select()` method allows you to specify which fields should be retrieved from the database, reducing data transfer and improving query performance. This is particularly useful when you only need specific fields from large entities.

### Basic Field Selection

```typescript
// Select single field
const usernames = await database.query(User).select('username').find();
// Result: [{ username: 'User1' }, { username: 'User2' }]

// Select multiple fields
const basicInfo = await database.query(User).select('id', 'username', 'created').find();
// Result: [{ id: 1, username: 'User1', created: Date }, ...]
```

### Important: Type Changes with Select

When using `select()`, the returned objects are **plain objects**, not entity instances:

```typescript
// Without select - returns entity instances
const user = await database.query(User).findOne();
console.log(user instanceof User); // true
user.someMethod(); // Works if User has methods

// With select - returns plain objects
const userData = await database.query(User).select('username').findOne();
console.log(userData instanceof User); // false
// userData.someMethod(); // Error! Not an entity instance
```

### When to Use Select

**Use `select()` when:**
- You need only specific fields for display or processing
- Working with large entities with many fields
- Building APIs that return specific data shapes
- Performance is critical and you want to minimize data transfer

**Avoid `select()` when:**
- You need the full entity for business logic
- You plan to modify and persist the entity
- You need entity methods or instanceof checks

### Performance Benefits

```typescript
// Inefficient - loads all fields including large text fields
const users = await database.query(User).find();

// Efficient - loads only needed fields
const userList = await database.query(User)
    .select('id', 'username', 'email')
    .find();
```

## Order

The `orderBy()` method controls the sorting of query results. You can sort by one or multiple fields, and combine different sort directions to create complex ordering rules.

### Basic Sorting

```typescript
// Sort by creation date (newest first)
const recentUsers = await database.query(User).orderBy('created', 'desc').find();

// Sort by username alphabetically
const alphabeticalUsers = await database.query(User).orderBy('username', 'asc').find();
```

### Multiple Sort Criteria

Chain multiple `orderBy()` calls to create complex sorting rules. The first `orderBy()` is the primary sort, subsequent calls are used for tie-breaking:

```typescript
// Primary sort by visits (descending), then by username (ascending) for ties
const users = await database.query(User)
    .orderBy('visits', 'desc')     // Primary: most active users first
    .orderBy('username', 'asc')    // Secondary: alphabetical for same visit count
    .find();

// Sort by creation date, then by ID for consistent ordering
const consistentOrder = await database.query(User)
    .orderBy('created', 'desc')
    .orderBy('id', 'asc')
    .find();
```

### Sort Directions

- `'asc'` - Ascending order (A-Z, 0-9, oldest to newest)
- `'desc'` - Descending order (Z-A, 9-0, newest to oldest)

### Performance Considerations

For optimal performance, ensure you have database indexes on fields used in `orderBy()`:

```typescript
@entity.name('user')
class User {
    id: number & PrimaryKey & AutoIncrement = 0;
    created: Date & Index = new Date();  // Index for sorting performance
    username: string & Index = '';       // Index for sorting performance
    visits: number = 0;
}
```

## Pagination

Pagination is essential for handling large datasets efficiently. Deepkit ORM provides two approaches: high-level pagination methods and low-level limit/skip methods.

### High-Level Pagination

Use `itemsPerPage()` and `page()` for user-friendly pagination:

```typescript
// Get first page (20 users per page)
const firstPage = await database.query(User)
    .itemsPerPage(20)
    .page(1)  // Pages start at 1
    .find();

// Get third page
const thirdPage = await database.query(User)
    .itemsPerPage(20)
    .page(3)
    .find();
```

### Low-Level Pagination

Use `limit()` and `skip()` for more control:

```typescript
// Skip first 10 users, get next 5
const users = await database.query(User)
    .skip(10)
    .limit(5)
    .find();

// Equivalent to page 3 with 20 items per page
const page3 = await database.query(User)
    .skip(40)  // (page - 1) * itemsPerPage = (3 - 1) * 20
    .limit(20)
    .find();
```

### Complete Pagination Example

```typescript
async function getUsersPage(page: number, pageSize: number = 20) {
    const users = await database.query(User)
        .orderBy('created', 'desc')  // Consistent ordering important for pagination
        .itemsPerPage(pageSize)
        .page(page)
        .find();

    const totalUsers = await database.query(User).count();
    const totalPages = Math.ceil(totalUsers / pageSize);

    return {
        users,
        pagination: {
            currentPage: page,
            pageSize,
            totalUsers,
            totalPages,
            hasNextPage: page < totalPages,
            hasPreviousPage: page > 1
        }
    };
}
```

### Performance Tips

- Always use `orderBy()` with pagination to ensure consistent results
- Consider using cursor-based pagination for very large datasets
- Use `count()` sparingly as it can be expensive on large tables

[#database-join]
## Join

By default, references from the entity are neither included in queries nor loaded. To include a join in the query without loading the reference, use `join()` (left join) or `innerJoin()`. To include a join in the query and load the reference, use `joinWith()` or `innerJoinWith()`.

All the following examples assume these model schemas:

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
//select only users with a group assigned (INNER JOIN)
const users = await session.query(User).innerJoin('group').find();
for (const user of users) {
    user.group; //error, since reference was not loaded
}
```

```typescript
//select only users with a group assigned (INNER JOIN) and load the relation
const users = await session.query(User).innerJoinWith('group').find();
for (const user of users) {
    user.group.name; //works
}
```

To modify join queries, use the same methods, but with the `use` prefix: `useJoin`, `useInnerJoin`, `useJoinWith` or `useInnerJoinWith`. To end the join query modification, use `end()` to get back the parent query.

```typescript
//select only users with a group with name 'admins' assigned (INNER JOIN)
const users = await session.query(User)
    .useInnerJoinWith('group')
        .filter({name: 'admins'})
        .end()  // returns to the parent query
    .find();

for (const user of users) {
    user.group.name; //always admin
}
```

## Aggregation

Aggregation methods allow you to count records and aggregate fields.

The following examples assume this model scheme:

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

`groupBy` allows to group the result by the specified field.

```typescript
await database.persist(
    cast<File>({path: 'file1', category: 'images'}),
    cast<File>({path: 'file2', category: 'images'}),
    cast<File>({path: 'file3', category: 'pdfs'})
);

//[ { category: 'images' }, { category: 'pdfs' } ]
await session.query(File).groupBy('category').find();
```

There are several aggregation methods: `withSum`, `withAverage`, `withCount`, `withMin`, `withMax`, `withGroupConcat`. Each requires a field name as the first argument and an optional second argument to change the alias.

```typescript
// first let's update some of the records:
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

With `returning` additional fields can be requested in case of changes via `patch` and `delete`.

Caution: Not all database adapters return fields atomically. Use transactions to ensure data consistency.

```typescript
await database.query(User).patchMany({visits: 0});

//{ modified: 1, returning: { visits: [ 5 ] }, primaryKeys: [ 1 ] }
const result = await database.query(User)
    .filter({username: 'User1'})
    .returning('username', 'visits')
    .patchOne({$inc: {visits: 5}});
```

## Find

Returns an array of entries matching the specified filter.

```typescript
const users: User[] = await database.query(User).filter({username: 'Peter'}).find();
```

## FindOne

Returns an item that matches the specified filter.
If no item is found, an `ItemNotFound` error is thrown.

```typescript
const users: User = await database.query(User).filter({username: 'Peter'}).findOne();
```

## FindOneOrUndefined

Returns an entry that matches the specified filter.
If no entry is found, undefined is returned.

```typescript
const query = database.query(User).filter({username: 'Peter'});
const users: User|undefined = await query.findOneOrUndefined();
```

## FindField

Returns a list of a field that match the specified filter.

```typescript
const usernames: string[] = await database.query(User).findField('username');
```

## FindOneField

Returns a list of a field that match the specified filter.
If no entry is found, an `ItemNotFound` error is thrown.

```typescript
const username: string = await database.query(User).filter({id: 3}).findOneField('username');
```

## Patch

Patch is a change query that patches the records described in the query. The methods
`patchOne` and `patchMany` finish the query and execute the patch.

`patchMany` changes all records in the database that match the specified filter. If no filter is set, the whole table will be changed. Use `patchOne` to change only one entry at a time.

```typescript
await database.query(User).filter({username: 'Peter'}).patch({username: 'Peter2'});

await database.query(User).filter({username: 'User1'}).patchOne({birthdate: new Date});
await database.query(User).filter({username: 'User1'}).patchOne({$inc: {visits: 1}});

await database.query(User).patchMany({visits: 0});
```

## Delete

`deleteMany` deletes all entries in the database that match the specified filter.
If no filter is set, the whole table will be deleted. Use `deleteOne` to delete only one entry at a time.

```typescript
const result = await database.query(User)
    .filter({visits: 0})
    .deleteMany();

const result = await database.query(User).filter({id: 4}).deleteOne();
```

## Has

Returns whether at least one entry exists in the database.

```typescript
const userExists: boolean = await database.query(User).filter({username: 'Peter'}).has();
```

## Count

Returns the number of entries.

```typescript
const userCount: number = await database.query(User).count();
```

## Lift

Lifting a query means adding new functionality to it. This is usually used either by plugins or complex architectures to split larger query classes into several convenient, reusable classes.

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
```

## Aggregation

Deepkit ORM supports powerful aggregation functions that allow you to perform calculations on groups of data. These functions are particularly useful for analytics and reporting.

### Basic Aggregation Functions

```typescript
@entity.name('product')
class Product {
    id: number & PrimaryKey & AutoIncrement = 0;
    category: string = '';
    title: string = '';
    price: number = 0;
    rating: number = 0;
}

const database = new Database(...);

// Sum all prices
const totalValue = await database.query(Product).withSum('price').find();
// Result: [{ price: 12345 }]

// Count all products
const productCount = await database.query(Product).withCount('id', 'total').find();
// Result: [{ total: 150 }]

// Get minimum price
const cheapest = await database.query(Product).withMin('price').find();
// Result: [{ price: 9.99 }]

// Get maximum price
const mostExpensive = await database.query(Product).withMax('price').find();
// Result: [{ price: 999.99 }]

// Calculate average price
const avgPrice = await database.query(Product).withAverage('price').find();
// Result: [{ price: 125.50 }]
```

### Group By with Aggregation

Combine `groupBy()` with aggregation functions to perform calculations per group:

```typescript
// Group by category and sum prices
const categoryTotals = await database.query(Product)
    .groupBy('category')
    .withSum('price')
    .orderBy('category')
    .find();
// Result: [
//   { category: 'electronics', price: 5000 },
//   { category: 'books', price: 250 }
// ]

// Count products per category
const categoryCounts = await database.query(Product)
    .groupBy('category')
    .withCount('id', 'productCount')
    .orderBy('category')
    .find();
// Result: [
//   { category: 'electronics', productCount: 25 },
//   { category: 'books', productCount: 100 }
// ]

// Multiple aggregations
const categoryStats = await database.query(Product)
    .groupBy('category')
    .withCount('id', 'count')
    .withSum('price', 'totalValue')
    .withAverage('price', 'avgPrice')
    .withMin('price', 'cheapest')
    .withMax('price', 'mostExpensive')
    .orderBy('category')
    .find();
```

### Group Concatenation

The `withGroupConcat()` function concatenates values within each group:

```typescript
// Concatenate all product titles per category
const categoryProducts = await database.query(Product)
    .groupBy('category')
    .withGroupConcat('title')
    .find();

// Note: Result format depends on database adapter
// SQLite: [{ category: 'books', title: 'Book1,Book2,Book3' }]
// MongoDB: [{ category: 'books', title: ['Book1', 'Book2', 'Book3'] }]
```

### Filtering Aggregated Results

You can filter both before and after aggregation:

```typescript
// Filter before aggregation (affects input data)
const expensiveCategoryTotals = await database.query(Product)
    .filter({ price: { $gt: 100 } })  // Only expensive products
    .groupBy('category')
    .withSum('price')
    .find();

// Filter after aggregation (affects aggregated results)
const highValueCategories = await database.query(Product)
    .groupBy('category')
    .withSum('price')
    .filter({ price: { $gt: 1000 } })  // Only categories with total > 1000
    .find();

await session.query(User).lift(UserQuery).hasBirthday().find();
```
