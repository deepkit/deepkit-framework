# Testing Strategy

This document outlines the testing strategy, coverage requirements, and edge case handling for the Deepkit Framework.

## Table of Contents

1. [Test Infrastructure](#test-infrastructure)
2. [Test Categories](#test-categories)
3. [Coverage Requirements](#coverage-requirements)
4. [Edge Cases by Package](#edge-cases-by-package)
5. [Running Tests](#running-tests)
6. [Writing New Tests](#writing-new-tests)
7. [Integration Testing](#integration-testing)
8. [Performance Testing](#performance-testing)

---

## Test Infrastructure

### Framework

- **Jest** as the test runner
- Custom resolver (`jest-resolver.js`) for monorepo symlink handling
- TypeScript compilation via `ts-jest`
- Memory flags: `--expose-gc --max_old_space_size=3048`

### Configuration

```javascript
// Root package.json jest config
{
  "jest": {
    "resolver": "./jest-resolver.js",
    "testPathIgnorePatterns": ["packages/*/dist"],
    "projects": [
      "packages/type",
      "packages/type-compiler",
      "packages/orm",
      // ... all testable packages
    ]
  }
}
```

### Requirements

- Node.js >= 20
- Type compiler must be installed: `npm run postinstall`
- External services for integration tests:
  - MongoDB
  - PostgreSQL
  - MySQL

---

## Test Categories

### 1. Unit Tests

Location: `packages/*/tests/*.spec.ts`

Test individual functions and classes in isolation.

```typescript
// packages/type/tests/serializer.spec.ts
test('serialize string', () => {
    expect(serialize<string>('hello')).toBe('hello');
});

test('deserialize date', () => {
    const date = deserialize<Date>('2024-01-15T00:00:00Z');
    expect(date).toBeInstanceOf(Date);
});
```

### 2. Type System Tests

Location: `packages/type/tests/`, `packages/type-compiler/tests/`

Test runtime type reflection accuracy.

```typescript
// Test type reflection
test('reflect interface', () => {
    interface User {
        id: number;
        name: string;
    }

    const type = typeOf<User>();
    expect(type.kind).toBe(ReflectionKind.objectLiteral);
    expect(type.types).toHaveLength(2);
});

// Test type operations
test('validate with constraints', () => {
    type Username = string & MinLength<3>;
    const errors = validate<Username>('ab');
    expect(errors).toHaveLength(1);
    expect(errors[0].code).toBe('minLength');
});
```

### 3. Integration Tests

Location: `packages/*/tests/integration/` or inline

Test cross-package interactions.

```typescript
// packages/framework-integration/tests/
test('http + orm integration', async () => {
    const app = new App({
        imports: [new FrameworkModule()],
        controllers: [UserController],
    });

    const response = await app.get(HttpKernel).request(
        HttpRequest.GET('/users')
    );

    expect(response.statusCode).toBe(200);
});
```

### 4. Database Integration Tests

Location: `packages/orm/tests/`, `packages/postgres/tests/`, etc.

Require running database instances.

```typescript
// packages/postgres/tests/postgres.spec.ts
test('query with joins', async () => {
    const database = new Database(
        new PostgresDatabaseAdapter({
            host: 'localhost',
            database: 'test',
        }),
        [User, Post]
    );

    await database.migrate();

    const users = await database.query(User)
        .joinWith('posts')
        .find();

    expect(users[0].posts).toBeDefined();
});
```

### 5. Serialization Round-Trip Tests

Ensure data survives serialize → deserialize cycle.

```typescript
test('round-trip complex object', () => {
    interface Data {
        date: Date;
        buffer: Uint8Array;
        bigint: bigint;
        nested: { value: number };
    }

    const original: Data = {
        date: new Date(),
        buffer: new Uint8Array([1, 2, 3]),
        bigint: 123n,
        nested: { value: 42 },
    };

    const serialized = serialize<Data>(original);
    const deserialized = deserialize<Data>(serialized);

    expect(deserialized.date.getTime()).toBe(original.date.getTime());
    expect(deserialized.buffer).toEqual(original.buffer);
    expect(deserialized.bigint).toBe(original.bigint);
    expect(deserialized.nested.value).toBe(42);
});
```

---

## Coverage Requirements

### Critical Packages (>80% coverage target)

| Package | Coverage Target | Rationale |
|---------|-----------------|-----------|
| `@deepkit/type` | 90% | Core type system, affects everything |
| `@deepkit/type-compiler` | 85% | Compiler correctness is critical |
| `@deepkit/injector` | 85% | DI bugs cause cascading failures |
| `@deepkit/orm` | 80% | Data integrity at stake |
| `@deepkit/http` | 80% | User-facing, security implications |
| `@deepkit/rpc` | 80% | Protocol correctness required |

### Standard Packages (>60% coverage target)

| Package | Coverage Target |
|---------|-----------------|
| `@deepkit/app` | 70% |
| `@deepkit/bson` | 75% |
| `@deepkit/sql` | 70% |
| `@deepkit/broker` | 65% |
| `@deepkit/event` | 70% |
| `@deepkit/workflow` | 70% |

### Running Coverage

```bash
npm run test:coverage

# Package-specific
node --expose-gc --max_old_space_size=3048 \
  node_modules/jest/bin/jest.js \
  --coverage packages/type/
```

---

## Edge Cases by Package

### @deepkit/type

**Serialization Edge Cases:**
- `undefined` vs `null` handling
- Optional properties with default values
- Circular references
- Very large numbers (beyond safe integer)
- Unicode strings (emoji, surrogates)
- Empty arrays and objects
- Typed arrays (Uint8Array, etc.)
- BigInt serialization
- Date timezone handling
- NaN and Infinity

**Validation Edge Cases:**
- Union type discrimination
- Intersection type constraints
- Generic type resolution
- Recursive types
- Conditional types
- Template literal types
- Mapped types

**Reflection Edge Cases:**
- Class inheritance chains
- Method overloading
- Private/protected members
- Static properties
- Decorators on inherited methods
- Generic constraints

### @deepkit/type-compiler

**Compilation Edge Cases:**
- Circular imports
- Re-exported types
- Namespace imports
- Dynamic imports
- Declaration files (.d.ts)
- `@reflection never` annotation
- Generic type parameters
- Type-only imports
- Ambient declarations

### @deepkit/orm

**Query Edge Cases:**
- NULL comparisons
- Empty IN clauses
- Deep nested joins (>3 levels)
- Self-referencing relations
- Composite primary keys
- JSON column queries
- Full-text search
- Pagination with sorting
- Transactions with nested saves

**Change Detection Edge Cases:**
- Partial updates
- Array modifications
- Embedded object changes
- Reference changes
- Soft delete with relations
- Concurrent modifications

### @deepkit/http

**Request Handling Edge Cases:**
- Malformed JSON body
- Missing required parameters
- Type coercion (string "123" → number)
- File uploads
- Large request bodies
- Slow clients (timeout handling)
- Connection drops mid-request
- Unicode in URLs
- Query parameter arrays

**Response Edge Cases:**
- Stream responses
- Large JSON responses
- Binary responses
- Empty responses
- Error serialization
- CORS headers

### @deepkit/rpc

**Protocol Edge Cases:**
- Connection drops mid-call
- Large message chunking
- Concurrent calls
- Observable backpressure
- Authentication failures
- Malformed messages
- Version mismatches
- Peer-to-peer routing

### @deepkit/injector

**Resolution Edge Cases:**
- Circular dependencies
- Missing providers
- Scope mismatches
- Optional dependencies
- Multiple providers for same token
- Factory errors
- Async providers
- Tagged providers

---

## Running Tests

### All Tests

```bash
npm run test
```

### Specific Package

```bash
npm run test packages/type/
npm run test packages/orm/
```

### Single Test File

```bash
node --expose-gc --max_old_space_size=3048 \
  node_modules/jest/bin/jest.js \
  packages/type/tests/serializer.spec.ts
```

### Watch Mode

```bash
node --expose-gc --max_old_space_size=3048 \
  node_modules/jest/bin/jest.js \
  --watch packages/type/
```

### Debugging Tests

```bash
node --expose-gc --max_old_space_size=3048 \
  --inspect-brk \
  node_modules/jest/bin/jest.js \
  --runInBand \
  packages/type/tests/serializer.spec.ts
```

---

## Writing New Tests

### Test File Structure

```typescript
import { expect, test, describe, beforeEach, afterEach } from '@jest/globals';

describe('FeatureName', () => {
    let fixture: FixtureType;

    beforeEach(() => {
        fixture = createFixture();
    });

    afterEach(() => {
        fixture.cleanup();
    });

    describe('methodName', () => {
        test('should handle normal case', () => {
            // Arrange
            const input = createInput();

            // Act
            const result = fixture.methodName(input);

            // Assert
            expect(result).toBe(expected);
        });

        test('should handle edge case: empty input', () => {
            expect(fixture.methodName([])).toEqual([]);
        });

        test('should throw on invalid input', () => {
            expect(() => fixture.methodName(null)).toThrow();
        });
    });
});
```

### Testing Types

```typescript
// Test type reflection
test('type reflection', () => {
    interface TestType {
        required: string;
        optional?: number;
    }

    const type = typeOf<TestType>();

    expect(type.kind).toBe(ReflectionKind.objectLiteral);

    const required = type.types.find(t => t.name === 'required');
    expect(required?.optional).toBe(false);

    const optional = type.types.find(t => t.name === 'optional');
    expect(optional?.optional).toBe(true);
});
```

### Testing Async Operations

```typescript
test('async operation', async () => {
    const result = await asyncFunction();
    expect(result).toBeDefined();
});

test('async error handling', async () => {
    await expect(asyncFunctionThatThrows()).rejects.toThrow('Expected error');
});
```

### Testing with Memory Cleanup

```typescript
test('memory is released', async () => {
    const before = process.memoryUsage().heapUsed;

    // Create and discard large objects
    for (let i = 0; i < 1000; i++) {
        const obj = createLargeObject();
        // obj goes out of scope
    }

    // Force garbage collection (requires --expose-gc)
    if (global.gc) global.gc();

    const after = process.memoryUsage().heapUsed;

    // Memory should not grow significantly
    expect(after - before).toBeLessThan(10 * 1024 * 1024); // 10MB
});
```

---

## Integration Testing

### Database Setup

```typescript
// tests/setup/database.ts
export async function createTestDatabase() {
    const database = new Database(
        new SQLiteDatabaseAdapter(':memory:'),
        [User, Post, Comment]
    );

    await database.migrate();
    return database;
}

export async function seedDatabase(database: Database) {
    const session = database.createSession();

    const user = new User();
    user.name = 'Test User';
    session.add(user);

    await session.commit();
    return { user };
}
```

### HTTP Testing

```typescript
// tests/helpers/http.ts
export function createTestApp(options: AppOptions) {
    return new App({
        ...options,
        imports: [
            new FrameworkModule({
                debug: false,
                port: 0, // Random port
            }),
        ],
    });
}

export async function request(app: App, req: HttpRequest) {
    const kernel = app.get(HttpKernel);
    return await kernel.request(req);
}
```

### RPC Testing

```typescript
// Use DirectClient for in-process testing
test('rpc action', async () => {
    const kernel = new RpcKernel([MyController]);
    const client = new DirectClient(kernel);

    const controller = client.controller<MyController>('my');
    const result = await controller.myAction('param');

    expect(result).toBe(expected);
});
```

---

## Performance Testing

### Benchmark Structure

```typescript
// tests/benchmark/serialization.bench.ts
import { bench, describe } from 'vitest';

describe('serialization performance', () => {
    const data = generateTestData(10000);

    bench('serialize<User[]>', () => {
        serialize<User[]>(data);
    });

    bench('deserialize<User[]>', () => {
        deserialize<User[]>(serializedData);
    });
});
```

### Profiling

```bash
# CPU profiling
node --prof packages/type/tests/benchmark.js
node --prof-process isolate-*.log > processed.txt

# Memory profiling
node --inspect packages/type/tests/benchmark.js
# Connect Chrome DevTools and take heap snapshots
```

### Performance Regression Detection

```typescript
test('serialization performance', () => {
    const iterations = 10000;
    const data = createTestData();

    const start = performance.now();
    for (let i = 0; i < iterations; i++) {
        serialize<TestType>(data);
    }
    const duration = performance.now() - start;

    const opsPerSecond = iterations / (duration / 1000);

    // Fail if performance degrades significantly
    expect(opsPerSecond).toBeGreaterThan(100000); // 100K ops/sec minimum
});
```

---

## Test Maintenance

### Flaky Test Handling

1. Identify flaky tests in CI logs
2. Add `retry` or `skip` with explanation
3. Create issue to investigate root cause
4. Fix underlying timing/state issues

### Test Data Management

- Use factories for test data creation
- Avoid hardcoded IDs (use sequences)
- Clean up after tests (use `afterEach`)
- Isolate database tests (use transactions or in-memory)

### CI Configuration

```yaml
# .github/workflows/test.yml
test:
  runs-on: ubuntu-latest
  services:
    postgres:
      image: postgres:15
    mongodb:
      image: mongo:6
    mysql:
      image: mysql:8
  steps:
    - uses: actions/checkout@v4
    - uses: actions/setup-node@v4
      with:
        node-version: '20'
    - run: yarn
    - run: npm run postinstall
    - run: npm run test
```
