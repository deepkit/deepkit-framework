# Benchmarks and Performance Tracking

This document outlines the benchmark suite, performance tracking methodology, and optimization strategies for the Deepkit Framework.

## Table of Contents

1. [Performance Goals](#performance-goals)
2. [Benchmark Suite](#benchmark-suite)
3. [Key Metrics](#key-metrics)
4. [Running Benchmarks](#running-benchmarks)
5. [Performance Regression Detection](#performance-regression-detection)
6. [Optimization Strategies](#optimization-strategies)
7. [Comparative Benchmarks](#comparative-benchmarks)

---

## Performance Goals

### Primary Objectives

1. **Serialization**: Maximize throughput for simple and complex types
2. **Validation**: Minimize overhead so validation is never skipped
3. **BSON**: Outperform official bson-js through JIT compilation
4. **DI Resolution**: Near-zero overhead for cached resolution
5. **HTTP Overhead**: Minimal framework overhead per request

### Why Performance Matters

Deepkit's value proposition depends on runtime type operations being fast enough that developers don't need to avoid them. If validation takes 10ms, developers will skip it in hot paths. If serialization is slow, they'll use raw JSON.

---

## Benchmark Suite

### Location

```
benchmarks/                           # Main benchmark infrastructure
├── src/
│   ├── benchmarks/
│   │   ├── core/                    # Core package benchmarks (public APIs)
│   │   │   ├── type/                # serialization, validation, reflection, change-detection
│   │   │   ├── bson/                # BSON serialization/deserialization
│   │   │   ├── injector/            # DI resolution, scaling
│   │   │   ├── http/                # HTTP router, request handling
│   │   │   ├── rpc/                 # RPC messages, actions
│   │   │   ├── orm/                 # ORM queries, persistence
│   │   │   └── ...
│   │   ├── comparison/              # Comparative benchmarks vs other libraries
│   │   ├── debug/                   # Internal/microbenchmarks (not in baseline)
│   │   └── baselines/               # Saved baseline files
│   │       └── baseline-pre-jit-refactor.json
│   └── reporter/                    # Benchmark reporters (console, JSON, comparison)
├── package.json
└── README.md

packages/bench/              # BenchSuite API (used by benchmarks/)
packages/*/benchmarks/       # Package-internal microbenchmarks (optional)
```

### Current Baseline (Pre-JIT Refactor)

**306 benchmarks across 15 suites:**

| Suite | Benchmarks | Key Operations |
|-------|------------|----------------|
| type/validation | 33 | guard, validate, is, constraints |
| type/reflection | 37 | typeOf, ReflectionClass, property access |
| type/serialization | 24 | serialize/deserialize, complex types |
| type/change-detection | 21 | snapshot, changeDetector, PK extraction |
| bson/serialization | 19 | BSON encode/decode, arrays, nested |
| injector/scaling | 26 | provider scaling 10-500, scopes, tags |
| injector/di | 10 | basic DI resolution |
| http/router | 28 | route matching, request resolution |
| rpc/messages | 29 | message creation, serialization |
| rpc/actions | 20 | action calls, batching, errors |
| orm/sqlite | 18 | queries, persist, session |
| app/module | 15 | module creation, config |
| event/dispatcher | 9 | event emission |
| logger/core | 14 | logging overhead |
| core/async | 3 | async primitives |

### Benchmark Categories

#### 1. Type Operations

```typescript
// packages/type/tests/benchmark.ts

// Serialization
bench('serialize<string>', () => serialize<string>('hello'));
bench('serialize<number>', () => serialize<number>(42));
bench('serialize<Date>', () => serialize<Date>(new Date()));
bench('serialize<User>', () => serialize<User>(user));
bench('serialize<User[]>', () => serialize<User[]>(users));

// Deserialization
bench('deserialize<string>', () => deserialize<string>('hello'));
bench('deserialize<Date>', () => deserialize<Date>('2024-01-15T00:00:00Z'));
bench('deserialize<User>', () => deserialize<User>(userData));

// Validation
bench('validate<string>', () => validate<string>('hello'));
bench('validate<User>', () => validate<User>(user));
bench('validate<User[]>', () => validate<User[]>(users));

// Type reflection
bench('typeOf<User>', () => typeOf<User>());
bench('ReflectionClass.from(User)', () => ReflectionClass.from(User));
```

#### 2. BSON Operations

```typescript
// packages/bson/tests/benchmark.ts

// Serialization
bench('serializeBSON<User>', () => serializeBSON<User>(user));
bench('serializeBSON<User[]> (1000)', () => serializeBSON<User[]>(users1000));

// Deserialization
bench('deserializeBSON<User>', () => deserializeBSON<User>(bsonData));
bench('deserializeBSON<User[]> (1000)', () => deserializeBSON<User[]>(bsonArray));

// Comparison with official bson
bench('official bson serialize', () => BSON.serialize(user));
bench('official bson deserialize', () => BSON.deserialize(bsonData));
```

#### 3. ORM Operations

```typescript
// packages/orm/tests/benchmark.ts

// Query building (no execution)
bench('Query.filter()', () => db.query(User).filter({ id: 1 }));
bench('Query.filter().orderBy().limit()', () =>
    db.query(User).filter({ active: true }).orderBy('createdAt', 'desc').limit(10)
);

// Hydration
bench('hydrate 1 entity', () => formatter.hydrate(User, row));
bench('hydrate 100 entities', () => rows.map(r => formatter.hydrate(User, r)));
bench('hydrate 1000 entities', () => rows.map(r => formatter.hydrate(User, r)));

// Change detection
bench('detectChanges (no changes)', () => classState.changeDetector(snapshot, snapshot, entity));
bench('detectChanges (1 change)', () => classState.changeDetector(oldSnapshot, newSnapshot, entity));
```

#### 4. HTTP Operations

```typescript
// packages/http/tests/benchmark.ts

// Route matching
bench('router.match() simple', () => router.match('GET', '/users'));
bench('router.match() with params', () => router.match('GET', '/users/123'));
bench('router.match() complex', () => router.match('POST', '/api/v1/users/123/posts'));

// Parameter deserialization
bench('deserialize query params', () => deserializeQuery(queryType, rawQuery));
bench('deserialize body', () => deserializeBody(bodyType, rawBody));
```

#### 5. DI Operations

```typescript
// packages/injector/tests/benchmark.ts

// Resolution
bench('injector.get() singleton', () => injector.get(SingletonService));
bench('injector.get() transient', () => injector.get(TransientService));
bench('injector.get() with deps', () => injector.get(ServiceWithDeps));

// Context creation
bench('createChildContext()', () => injector.createChildContext());
```

---

## Key Metrics

### What to Measure

Track these categories with regular benchmarking:

**Serialization Performance**
- Primitive types (string, number, boolean)
- Date conversion
- Simple objects (3-5 properties)
- Complex objects (10+ properties)
- Arrays of various sizes

**Validation Performance**
- Primitive types
- Types with constraints (MinLength, Positive, etc.)
- Nested objects
- Arrays with item validation

**BSON Performance**
- Serialization throughput
- Deserialization throughput
- Comparison with official bson-js

**Memory Usage**
- Type reflection overhead (first call vs cached)
- Serialization memory footprint
- ORM session memory with many entities

---

## Running Benchmarks

### Quick Benchmark

```bash
# From repository root
cd benchmarks

# Run all benchmarks
npm run benchmark

# Run specific category
npm run benchmark -- -d src/benchmarks/core/type
npm run benchmark -- -d src/benchmarks/core/bson
npm run benchmark -- -d src/benchmarks/core/injector

# Run comparison benchmarks (vs other libraries)
npm run benchmark:comparison
```

### Baseline Management

```bash
# Save current results as baseline
npm run benchmark -- --save-baseline

# Compare against saved baseline (shows regressions/improvements)
npm run benchmark -- --compare-baseline

# Export results to JSON
npm run benchmark -- -j results.json
```

### Detailed Benchmark with Profiling

```bash
# With V8 profiling
node --prof dist/serialization.bench.js
node --prof-process isolate-*.log > profile.txt

# With CPU profiling
node --cpu-prof dist/serialization.bench.js
# Open .cpuprofile in Chrome DevTools

# With memory profiling
node --inspect dist/serialization.bench.js
# Use Chrome DevTools Memory tab
```

### Benchmark Configuration

```typescript
// packages/bench/src/config.ts

export const ITERATIONS = {
    micro: 1_000_000,    // Fast operations
    small: 100_000,      // Medium operations
    medium: 10_000,      // Slower operations
    large: 1_000,        // Slow operations
};

export const WARMUP_ITERATIONS = 1000;

export function bench(name: string, fn: () => void, iterations?: number) {
    // Warmup
    for (let i = 0; i < WARMUP_ITERATIONS; i++) fn();

    // Force GC if available
    if (global.gc) global.gc();

    // Benchmark
    const start = performance.now();
    const count = iterations ?? ITERATIONS.micro;
    for (let i = 0; i < count; i++) fn();
    const duration = performance.now() - start;

    const opsPerSecond = count / (duration / 1000);
    console.log(`${name}: ${formatNumber(opsPerSecond)} ops/sec`);
}
```

---

## Performance Regression Detection

### CI Integration

```yaml
# .github/workflows/benchmark.yml
name: Benchmark

on:
  push:
    branches: [master]
  pull_request:
    branches: [master]

jobs:
  benchmark:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: yarn && npm run postinstall && npm run build

      - name: Run benchmarks
        run: node packages/bench/dist/index.js --json > benchmark-results.json

      - name: Compare with baseline
        run: node scripts/compare-benchmarks.js

      - name: Upload results
        uses: actions/upload-artifact@v4
        with:
          name: benchmark-results
          path: benchmark-results.json
```

### Regression Thresholds

```typescript
// scripts/compare-benchmarks.js

const REGRESSION_THRESHOLD = 0.9; // 10% slower = regression

function compareResults(current, baseline) {
    const regressions = [];

    for (const [name, ops] of Object.entries(current)) {
        const baselineOps = baseline[name];
        if (baselineOps && ops < baselineOps * REGRESSION_THRESHOLD) {
            regressions.push({
                name,
                current: ops,
                baseline: baselineOps,
                change: ((ops - baselineOps) / baselineOps * 100).toFixed(1) + '%',
            });
        }
    }

    if (regressions.length > 0) {
        console.error('Performance regressions detected:');
        console.table(regressions);
        process.exit(1);
    }
}
```

### Historical Tracking

Store benchmark results over time for trend analysis:

```typescript
// Append to benchmark history
const result = {
    commit: process.env.GITHUB_SHA,
    timestamp: new Date().toISOString(),
    results: benchmarkResults,
};

fs.appendFileSync('benchmark-history.jsonl', JSON.stringify(result) + '\n');
```

---

## Optimization Strategies

### 1. JIT Compilation

Generate optimized code paths for each type:

```typescript
// Instead of runtime type checking
function serializeGeneric(type: Type, value: any) {
    switch (type.kind) {
        case ReflectionKind.string: return value;
        case ReflectionKind.number: return value;
        // ... many branches
    }
}

// Generate specialized function
const serializer = compiler.build(`
    return {
        id: value.id,
        name: value.name,
        createdAt: value.createdAt.toISOString(),
    };
`);
```

### 2. Monomorphic Optimization

Keep object shapes consistent for V8 optimization:

```typescript
// Use toFastProperties to optimize object shapes
import { toFastProperties } from '@deepkit/core';

class TypeJitContainer {
    serialize?: Function;
    deserialize?: Function;
    validate?: Function;
}

toFastProperties(TypeJitContainer.prototype);
```

### 3. Avoid Allocations in Hot Paths

```typescript
// Bad: creates new array each call
function validate(value: any): ValidationError[] {
    const errors: ValidationError[] = [];
    // ...
    return errors;
}

// Good: reuse array, return count
function validate(value: any, errors: ValidationError[]): number {
    let count = 0;
    // ...
    return count;
}
```

### 4. Cache Aggressively

```typescript
// Cache compiled functions per type
const container = getTypeJitContainer(type);
if (!container.serialize) {
    container.serialize = compileSerializer(type);
}
return container.serialize;
```

### 5. Binary Protocols

BSON is faster than JSON for typed data:

```typescript
// JSON: parse string, type coercion needed
const data = JSON.parse(jsonString);
data.date = new Date(data.date); // Manual conversion

// BSON: binary, types preserved
const data = deserializeBSON<MyType>(bsonBuffer);
// data.date is already a Date
```

---

## Comparative Benchmarks

Run benchmarks against alternatives to track relative performance:

### Libraries to Compare

**Serialization**
- class-transformer
- superjson
- cerialize

**Validation**
- class-validator
- Zod
- io-ts
- Yup

**BSON**
- official bson-js
- bson-ext

**ORM Hydration**
- TypeORM
- Prisma
- MikroORM

### Running Comparative Benchmarks

```bash
# Run comparative benchmark suite
cd packages/bench
npm run bench:compare

# Output results in JSON for tracking
npm run bench:compare -- --json > results.json
```

Comparative benchmarks should be run on consistent hardware and Node.js versions to ensure meaningful comparisons over time.

---

## Benchmark Development Guidelines

### 1. Isolate What You're Measuring

```typescript
// Bad: includes object creation
bench('serialize', () => {
    const user = new User(); // This adds noise
    serialize<User>(user);
});

// Good: prepare data outside
const user = new User();
bench('serialize', () => {
    serialize<User>(user);
});
```

### 2. Warmup Before Measuring

JIT compilation happens on first calls:

```typescript
// Run enough iterations to trigger JIT
for (let i = 0; i < 1000; i++) serialize<User>(user);

// Now benchmark
const start = performance.now();
// ...
```

### 3. Control for GC

```typescript
// Force GC before benchmark
if (global.gc) global.gc();

// Or measure without GC by using many small iterations
// and taking the minimum time
```

### 4. Use Realistic Data

```typescript
// Bad: always same data
const user = { id: 1, name: 'test' };

// Good: varied data to prevent branch prediction artifacts
const users = Array.from({ length: 1000 }, (_, i) => ({
    id: i,
    name: `user${i}`,
    email: `user${i}@test.com`,
}));

let idx = 0;
bench('serialize', () => {
    serialize<User>(users[idx++ % users.length]);
});
```

### 5. Report Multiple Statistics

```typescript
function runBenchmark(fn: () => void, iterations: number) {
    const times: number[] = [];

    for (let i = 0; i < iterations; i++) {
        const start = performance.now();
        fn();
        times.push(performance.now() - start);
    }

    times.sort((a, b) => a - b);

    return {
        min: times[0],
        max: times[times.length - 1],
        median: times[Math.floor(times.length / 2)],
        p95: times[Math.floor(times.length * 0.95)],
        p99: times[Math.floor(times.length * 0.99)],
        mean: times.reduce((a, b) => a + b) / times.length,
    };
}
```
