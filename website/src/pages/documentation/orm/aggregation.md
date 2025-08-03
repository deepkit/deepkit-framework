# Aggregation

Deepkit ORM provides powerful aggregation capabilities that allow you to perform calculations and data analysis directly in the database. This is essential for building analytics, reports, and dashboards efficiently.

## Overview

Aggregation functions work by grouping data and performing calculations on each group. You can use aggregation with or without explicit grouping - without grouping, the entire result set is treated as one group.

```typescript
@entity.name('order')
class Order {
    id: number & PrimaryKey & AutoIncrement = 0;
    customerId: number = 0;
    amount: number = 0;
    status: 'pending' | 'completed' | 'cancelled' = 'pending';
    createdAt: Date = new Date();
}

@entity.name('product')
class Product {
    id: number & PrimaryKey & AutoIncrement = 0;
    category: string = '';
    name: string = '';
    price: number = 0;
    stock: number = 0;
}
```

## Aggregation Functions

### withSum()
Calculates the sum of numeric values:

```typescript
// Total revenue from all orders
const totalRevenue = await database.query(Order)
    .withSum('amount')
    .find();
// Result: [{ amount: 125430.50 }]

// Revenue per customer
const customerRevenue = await database.query(Order)
    .groupBy('customerId')
    .withSum('amount', 'totalSpent')
    .find();
// Result: [
//   { customerId: 1, totalSpent: 1250.00 },
//   { customerId: 2, totalSpent: 890.50 }
// ]
```

### withCount()
Counts the number of records:

```typescript
// Total number of orders
const orderCount = await database.query(Order)
    .withCount('id', 'totalOrders')
    .find();
// Result: [{ totalOrders: 1543 }]

// Orders per status
const statusCounts = await database.query(Order)
    .groupBy('status')
    .withCount('id', 'count')
    .find();
// Result: [
//   { status: 'pending', count: 45 },
//   { status: 'completed', count: 1480 },
//   { status: 'cancelled', count: 18 }
// ]
```

### withAverage()
Calculates the average value:

```typescript
// Average order amount
const avgOrderAmount = await database.query(Order)
    .withAverage('amount', 'averageOrder')
    .find();
// Result: [{ averageOrder: 81.25 }]

// Average price per product category
const avgPriceByCategory = await database.query(Product)
    .groupBy('category')
    .withAverage('price', 'avgPrice')
    .orderBy('category')
    .find();
```

### withMin() and withMax()
Find minimum and maximum values:

```typescript
// Price range analysis
const priceRange = await database.query(Product)
    .groupBy('category')
    .withMin('price', 'minPrice')
    .withMax('price', 'maxPrice')
    .withAverage('price', 'avgPrice')
    .orderBy('category')
    .find();
// Result: [
//   { category: 'electronics', minPrice: 9.99, maxPrice: 1999.99, avgPrice: 245.50 },
//   { category: 'books', minPrice: 5.99, maxPrice: 89.99, avgPrice: 24.50 }
// ]
```

### withGroupConcat()
Concatenates values within each group:

```typescript
// Get all product names per category
const productsByCategory = await database.query(Product)
    .groupBy('category')
    .withGroupConcat('name', 'products')
    .find();

// Note: Output format varies by database adapter
// SQLite: { category: 'books', products: 'Book1,Book2,Book3' }
// MongoDB: { category: 'books', products: ['Book1', 'Book2', 'Book3'] }
// MySQL/PostgreSQL: { category: 'books', products: 'Book1,Book2,Book3' }
```

## Advanced Aggregation Patterns

### Multiple Aggregations
Combine multiple aggregation functions in a single query:

```typescript
const comprehensiveStats = await database.query(Order)
    .groupBy('status')
    .withCount('id', 'orderCount')
    .withSum('amount', 'totalRevenue')
    .withAverage('amount', 'avgOrderValue')
    .withMin('amount', 'smallestOrder')
    .withMax('amount', 'largestOrder')
    .orderBy('status')
    .find();
```

### Conditional Aggregation
Use filters to create conditional aggregations:

```typescript
// Revenue from completed orders only
const completedRevenue = await database.query(Order)
    .filter({ status: 'completed' })
    .withSum('amount', 'completedRevenue')
    .find();

// High-value orders per customer
const highValueCustomers = await database.query(Order)
    .filter({ amount: { $gte: 100 } })
    .groupBy('customerId')
    .withCount('id', 'highValueOrders')
    .withSum('amount', 'highValueRevenue')
    .filter({ highValueRevenue: { $gte: 1000 } })
    .find();
```

### Time-based Aggregation
Aggregate data by time periods:

```typescript
// Note: Exact syntax may vary by database adapter
// Monthly revenue (example for SQL databases)
const monthlyRevenue = await database.query(Order)
    .filter({ status: 'completed' })
    .groupBy('YEAR(createdAt)', 'MONTH(createdAt)')
    .withSum('amount', 'revenue')
    .withCount('id', 'orderCount')
    .orderBy('YEAR(createdAt)', 'MONTH(createdAt)')
    .find();
```

## Performance Considerations

### Indexing for Aggregation
Ensure proper indexing for fields used in:
- `groupBy()` clauses
- `filter()` conditions
- Aggregated fields

```typescript
// Example: Index on frequently grouped/filtered fields
@entity.name('order')
class Order {
    id: number & PrimaryKey & AutoIncrement = 0;

    customerId: number & Index = 0;
    status: 'pending' | 'completed' | 'cancelled' & Index = 'pending';
    amount: number = 0;
    createdAt: Date & Index = new Date();
}
```

### Large Dataset Considerations
For large datasets, consider:
- Using `limit()` with aggregation when appropriate
- Implementing pagination for aggregated results
- Using database-specific optimization features

```typescript
// Top 10 customers by revenue
const topCustomers = await database.query(Order)
    .groupBy('customerId')
    .withSum('amount', 'totalRevenue')
    .orderBy('totalRevenue', 'desc')
    .limit(10)
    .find();
```

## Database Adapter Differences

Different database adapters may have slight variations in aggregation behavior:

- **SQLite**: Group concatenation returns comma-separated strings
- **MongoDB**: Group concatenation returns arrays
- **MySQL/PostgreSQL**: Support more advanced date/time grouping functions
- **Memory Database**: Full aggregation support for testing

Always test aggregation queries with your specific database adapter to ensure expected behavior.
