# Major Refactor Plan

> **Status:** Planning phase
> **Branch:** `feat/next` (will create feature branches as needed)
> **Last updated:** 2026-01-20

This document tracks the major refactoring efforts for Deepkit's infrastructure layer, focusing on performance, unification, and maintainability.

---

## Strategic Vision

**Goal:** Build the fastest TypeScript database and RPC infrastructure by:
1. Writing custom database clients (not wrapping existing drivers)
2. Eliminating object allocations in hot paths
3. Using JIT compilation for serialization/deserialization
4. Benchmark-driven development (every decision measurable)

**Principle:** If we can't measure it, we can't improve it.

---

## Phase 0: Core Infrastructure Primitives

Before optimizing individual packages, establish reusable primitives.

**Package location:** `@deepkit/orm` (not `@deepkit/core`)

Why ORM? Because:
- All database clients depend on ORM anyway (ORM-first design)
- ORM = type mapping for ALL data stores (SQL, MongoDB, Redis, etc.)
- `@deepkit/core` must stay browser-safe (used by `@deepkit/type`)
- ORM already has the expression tree / query building infrastructure

**No Buffer dependency:** All primitives use `Uint8Array` + `DataView` (standard JS, works everywhere).

### 0.1 ContextDispatcher

**Source:** `feat/better-rpc` branch (`packages/rpc/src/protocol.ts`)

A high-performance async operation tracker using array slots instead of Map/object lookups.

```typescript
export class ContextDispatcher<T = (message: Uint8Array) => void> {
    private contexts: T[] = createArray();    // Pre-allocated slots
    private freeSlots: number[] = [];         // Reuse pool
    private currentSlot = 1;

    create(callback: T): number {
        const slot = this.freeSlots.pop() || this.currentSlot++;
        if (slot >= this.contexts.length) {
            this.contexts.push(...createArray());  // Grow by chunks
        }
        this.contexts[slot] = callback;
        return slot;
    }

    get(id: number): T {
        return this.contexts[id];
    }

    dispatch(id: number, ...args: Parameters<T extends (...args: any) => any ? T : never>) {
        (this.contexts[id] as any)(...args);
    }

    release(id: number) {
        this.contexts[id] = noop as any;
        this.freeSlots.push(id);
    }
}
```

**Use cases:**
- RPC: Track pending remote calls
- PostgreSQL: Pipeline multiple queries, dispatch responses by ID
- MySQL: Same pipelining pattern
- MongoDB: Track pending commands per connection
- Any async request/response correlation

**Why array slots?**
- O(1) lookup (direct index access)
- No hash computation
- Cache-friendly memory layout
- Slot reuse eliminates GC pressure

### 0.2 ConnectionWriter (Single Buffer Pattern)

**Key insight:** `socket.write(buffer)` copies data to kernel send buffer. After `write()` returns, userspace buffer is immediately reusable. No pool needed - one buffer per connection.

**No Buffer dependency:** Use standard `Uint8Array` + `DataView` (works in browser, Node, Bun, Deno).

```typescript
export class ConnectionWriter {
    private buffer: Uint8Array;
    private view: DataView;
    private offset = 0;
    private textEncoder = new TextEncoder();

    constructor(initialSize = 64 * 1024) {
        this.buffer = new Uint8Array(initialSize);
        this.view = new DataView(this.buffer.buffer);
    }

    ensureCapacity(needed: number) {
        if (this.offset + needed > this.buffer.length) {
            // Grow buffer (rare - most messages < 64KB)
            const newBuffer = new Uint8Array(this.buffer.length * 2);
            newBuffer.set(this.buffer.subarray(0, this.offset));
            this.buffer = newBuffer;
            this.view = new DataView(this.buffer.buffer);
        }
    }

    // Static content (pre-encoded, reused across calls)
    writeBytes(data: Uint8Array) {
        this.ensureCapacity(data.length);
        this.buffer.set(data, this.offset);
        this.offset += data.length;
    }

    // Dynamic values
    writeInt32LE(value: number) {
        this.ensureCapacity(4);
        this.view.setInt32(this.offset, value, true);  // true = little-endian
        this.offset += 4;
    }

    writeUint32LE(value: number) {
        this.ensureCapacity(4);
        this.view.setUint32(this.offset, value, true);
        this.offset += 4;
    }

    writeUTF8(str: string): number {
        // TextEncoder.encodeInto() is fast and avoids allocation
        this.ensureCapacity(str.length * 3);  // UTF-8 worst case
        const result = this.textEncoder.encodeInto(str, this.buffer.subarray(this.offset));
        this.offset += result.written!;
        return result.written!;
    }

    getBuffer(): Uint8Array {
        return this.buffer.subarray(0, this.offset);
    }

    flush(socket: { write(data: Uint8Array): void }): void {
        socket.write(this.buffer.subarray(0, this.offset));
        this.offset = 0;  // Immediately reusable - data copied to kernel
    }

    reset() {
        this.offset = 0;
    }
}
```

**Why not a pool?**
- Pool adds overhead: tracking, size selection, acquire/release
- Single buffer is simpler and just as fast
- Kernel copy means immediate reuse
- Growth is rare (most messages fit in 64KB)

**Use cases:**
- MongoDB: Command serialization
- PostgreSQL: Query encoding
- MySQL: Packet encoding
- Redis: RESP command encoding
- RPC: Message encoding

### 0.3 Message Template Pattern (Static + Dynamic)

**Key insight:** Database queries have static parts (SQL, command names) that never change at runtime, and dynamic parts (parameter values). Static parts can be pre-encoded to binary once and reused forever.

```typescript
// JIT-compiled message template
interface MessageTemplate {
    // Pre-encoded static parts (lives forever in memory)
    staticParts: Uint8Array[];
    // Dynamic slot definitions
    dynamicSlots: Array<{
        afterStatic: number;  // Which static part precedes this
        type: 'int32' | 'int64' | 'utf8' | 'bson' | 'custom';
        serializer?: (value: any, writer: ConnectionWriter) => void;
    }>;
}

// Helper to encode static strings once
const encode = (s: string) => new TextEncoder().encode(s);

// Example: SELECT * FROM users WHERE id = $1 AND active = $2
const selectUserTemplate: MessageTemplate = {
    staticParts: [
        encode('SELECT * FROM users WHERE id = '),
        encode(' AND active = '),
        new Uint8Array([0]),  // null terminator for PG
    ],
    dynamicSlots: [
        { afterStatic: 0, type: 'int32' },   // $1 = userId
        { afterStatic: 1, type: 'int32' },   // $2 = active (bool as int)
    ],
};

// Runtime execution - minimal work
function executeTemplate(
    template: MessageTemplate,
    values: any[],
    writer: ConnectionWriter
) {
    let slotIndex = 0;
    for (let i = 0; i < template.staticParts.length; i++) {
        writer.writeBuffer(template.staticParts[i]);  // memcpy pre-encoded

        // Write dynamic value if slot exists after this static part
        const slot = template.dynamicSlots[slotIndex];
        if (slot && slot.afterStatic === i) {
            writeDynamicValue(writer, slot, values[slotIndex]);
            slotIndex++;
        }
    }
}
```

**This pattern applies everywhere:**

| Protocol | Static Parts | Dynamic Parts |
|----------|--------------|---------------|
| PostgreSQL | SQL text, message headers | Parameter values |
| MySQL | SQL text, packet headers | Parameter values |
| MongoDB | Command structure, field names | Document values (BSON) |
| Redis | Command names (`SET`, `GET`) | Keys, values |
| RPC | Action IDs, headers | Arguments (BSON) |

**Benefits:**
- UTF-8 encoding happens once (at JIT compile time), not per query
- Static parts often fit in L1/L2 cache
- Dynamic serialization is minimal (just values)
- Pattern matches Deepkit's existing JIT philosophy

**Integration with ORM:**
```typescript
// Query class compiles template on first execution
class Query<T> {
    private template?: MessageTemplate;

    async find(params: Partial<T>): Promise<T[]> {
        if (!this.template) {
            // JIT compile on first use
            this.template = compileQueryTemplate(this.schema, this.filters);
        }
        // Execute with pre-compiled template
        return this.connection.execute(this.template, Object.values(params));
    }
}
```

### 0.4 Topology Manager (Primary/Replica + Transactions)

**Key insight:** Primary/replica routing and transaction handling are universal patterns that should be abstracted at the client layer, not left to each database's quirks.

```typescript
interface TopologyConfig {
    primary: ConnectionConfig;
    replicas?: ConnectionConfig[];

    // Read preference (MongoDB-inspired, generalized)
    defaultReadPreference?: ReadPreference;

    // Health checking
    healthCheckInterval?: number;
    healthCheckTimeout?: number;
}

type ReadPreference =
    | 'primary'            // Always primary (writes + reads)
    | 'primaryPreferred'   // Primary if available, else replica
    | 'replica'            // Always replica (reads only)
    | 'replicaPreferred'   // Replica if available, else primary
    | 'nearest';           // Lowest latency

interface TopologyManager<TConnection> {
    // Get connection based on operation type
    getConnection(options: {
        write?: boolean;
        readPreference?: ReadPreference;
        transaction?: Transaction;
    }): Promise<TConnection>;

    // Transaction management
    beginTransaction(options?: TransactionOptions): Promise<Transaction>;

    // Health
    getHealthStatus(): TopologyHealth;
}
```

**Routing Rules:**
```
┌─────────────────────────────────────────────────────────────┐
│                    TopologyManager                           │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Write operations ──────────────────────────► Primary        │
│                                                              │
│  Read operations ───┬─── primary ──────────► Primary        │
│                     ├─── primaryPreferred ─► Primary > Rep  │
│                     ├─── replica ──────────► Replicas (RR)  │
│                     ├─── replicaPreferred ─► Replicas > Pri │
│                     └─── nearest ──────────► Lowest latency │
│                                                              │
│  Within transaction ────────────────────────► Same connection│
│  (always primary)                              (sticky)      │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

**Transaction Abstraction:**
```typescript
interface Transaction {
    id: string;
    connection: TConnection;        // Sticky connection
    isolationLevel?: IsolationLevel;

    commit(): Promise<void>;
    rollback(): Promise<void>;

    // Savepoints (where supported)
    savepoint(name: string): Promise<void>;
    rollbackTo(name: string): Promise<void>;
}

type IsolationLevel =
    | 'readUncommitted'    // Dirty reads allowed
    | 'readCommitted'      // Default for most DBs
    | 'repeatableRead'     // Default for MySQL
    | 'serializable';      // Strictest

// Database support matrix
// PostgreSQL: all levels
// MySQL: all levels
// SQLite: serializable only (single-writer)
// MongoDB: readConcern/writeConcern (different model, mapped)
// Redis: MULTI/EXEC (optimistic, no isolation levels)
```

**Unified API across all databases:**
```typescript
// User code - same regardless of database
const db = new Database({
    primary: { host: 'primary.db', port: 5432 },
    replicas: [
        { host: 'replica1.db', port: 5432 },
        { host: 'replica2.db', port: 5432 },
        { host: 'replica3.db', port: 5432 },
    ],
    defaultReadPreference: 'replicaPreferred',
});

// Reads automatically go to replicas
const users = await db.query(User).find();  // → replica (round-robin)

// Writes go to primary
await db.persist(newUser);  // → primary

// Explicit read preference
const critical = await db.query(User)
    .readPreference('primary')  // Force primary for consistency
    .find();

// Transactions always use primary, sticky connection
await db.transaction(async (tx) => {
    const user = await tx.query(User).findOne();  // → primary
    user.balance -= 100;
    await tx.persist(user);                        // → same connection
});  // commit or rollback
```

**PostgreSQL-specific:** PG protocol has no native replica routing. Our client implements it:
- Maintain separate connection pools: 1 for primary, N for replicas
- Route based on operation type
- Health check all nodes, remove unhealthy from pool
- Optional: parse queries to detect writes (INSERT/UPDATE/DELETE) vs reads (SELECT)

**MongoDB-specific:** Already has replica set support, but we unify the API:
- Map our `ReadPreference` to MongoDB's `readPreference`
- Map our `IsolationLevel` to MongoDB's `readConcern`/`writeConcern`

**Redis-specific:** Redis Cluster + Sentinel support:
- Primary discovery via Sentinel
- Replica reads via READONLY mode
- MULTI/EXEC for transactions (optimistic)

**Health Checking:**
```typescript
interface TopologyHealth {
    primary: NodeHealth;
    replicas: NodeHealth[];

    // Replication lag (where measurable)
    replicationLag?: { [replicaId: string]: number };
}

interface NodeHealth {
    host: string;
    status: 'healthy' | 'unhealthy' | 'unknown';
    latency: number;        // ms
    lastCheck: Date;
    errorCount: number;     // Recent errors
}
```

### 0.5 Streaming Support

**Key insight:** All major databases support streaming/cursors. Unified streaming API enables memory-efficient processing of large datasets and real-time data.

**Database streaming capabilities:**

| Database | Cursors | Bulk Transfer | Real-time |
|----------|---------|---------------|-----------|
| PostgreSQL | ✓ DECLARE/FETCH | ✓ COPY protocol | ✓ LISTEN/NOTIFY |
| MySQL | ✓ Cursors | ✓ LOAD DATA | - |
| MongoDB | ✓ Cursors | ✓ Bulk ops | ✓ Change Streams |
| Redis | ✓ SCAN family | ✓ Pipeline batches | ✓ Pub/Sub, Streams |

**Unified streaming interface:**

```typescript
// Async iterator pattern - works with for-await-of
interface StreamingQuery<T> {
    // Cursor-based iteration (memory efficient)
    stream(batchSize?: number): AsyncIterable<T>;

    // Callback-based for backpressure control
    forEach(callback: (item: T) => void | Promise<void>): Promise<void>;

    // Collect with limit (safety valve)
    collect(maxItems?: number): Promise<T[]>;
}

// Usage - memory efficient, processes one batch at a time
for await (const user of db.query(User).filter({ active: true }).stream(100)) {
    await processUser(user);
}

// With backpressure - pauses fetching while processing
await db.query(User).stream(100).forEach(async (user) => {
    await slowProcess(user);  // DB waits before fetching next batch
});
```

**PostgreSQL COPY protocol:**

```typescript
// Bulk export - streaming rows out
const stream = db.copy(User).toStream();
for await (const row of stream) {
    await writeToFile(row);
}

// Bulk import - streaming rows in
await db.copy(User).fromStream(csvRowGenerator());
```

**MongoDB Change Streams:**

```typescript
// Real-time change notifications
const changes = db.watch(User).filter({ 'fullDocument.status': 'active' });

for await (const change of changes) {
    switch (change.operationType) {
        case 'insert': handleInsert(change.fullDocument); break;
        case 'update': handleUpdate(change.updateDescription); break;
        case 'delete': handleDelete(change.documentKey); break;
    }
}
```

**Redis Streams:**

```typescript
// Redis Streams (not Pub/Sub - persistent, consumer groups)
const stream = redis.stream('events');

// Produce
await stream.add({ type: 'order', data: orderData });

// Consume with consumer group
for await (const entry of stream.read({ group: 'workers', consumer: 'worker-1' })) {
    await processEntry(entry);
    await stream.ack(entry.id);
}
```

**Backpressure handling:**

```typescript
interface StreamOptions {
    batchSize?: number;          // Items per fetch (default: 100)
    highWaterMark?: number;      // Max buffered items before pausing
    signal?: AbortSignal;        // Cancellation support
}

// Implementation uses:
// - PostgreSQL: DECLARE CURSOR + FETCH <n>
// - MySQL: mysql2 streaming mode
// - MongoDB: cursor.batchSize() + cursor.next()
// - Redis: SCAN with COUNT
```

**Integration with Node.js streams:**

```typescript
import { Readable } from 'stream';

// Convert to Node.js Readable stream (for piping to file, HTTP response, etc.)
const readable = Readable.from(db.query(User).stream(100));
readable.pipe(transformStream).pipe(response);
```

### 0.6 Benchmark System (`@deepkit/bench`)

**Source:** `feat/better-rpc` branch (`packages/bench/`)

Per-package benchmark utilities with:
- Adaptive iteration selection (1x to 10M)
- GC event tracking
- Heap delta measurement
- Statistical analysis (RME, variance)
- Color-coded output

```typescript
import { benchmark, run } from '@deepkit/bench';

benchmark('operation name', () => {
    // code to measure
});

await run(1); // Run for 1 second
```

**Integration:**
- Each package has `benchmarks/` folder
- `npm run bench` in package runs all benchmarks
- CI tracks regressions (>10% slower = fail)

---

## Phase 1: Benchmark Infrastructure

**Goal:** Establish measurement foundation before any optimization.

### Tasks

| ID | Task | Status | Notes |
|----|------|--------|-------|
| 1.1 | Extract `@deepkit/bench` from `feat/better-rpc` | - | New package |
| 1.2 | Add `ContextDispatcher` to `@deepkit/core` | - | Generic version |
| 1.3 | Add `BufferPool` to `@deepkit/core` | - | With size classes |
| 1.4 | Create benchmark suite for `@deepkit/type` | - | Serialization, validation |
| 1.5 | Create benchmark suite for `@deepkit/bson` | - | Encode/decode |
| 1.6 | Create benchmark suite for `@deepkit/mongo` | - | Commands, connection |
| 1.7 | Create benchmark suite for `@deepkit/injector` | - | Resolution, scopes |
| 1.8 | CI integration for benchmark regression | - | GitHub Actions |

### Deliverables
- `packages/bench/` - Benchmark framework
- `packages/*/benchmarks/` - Per-package benchmarks
- Baseline measurements for all hot paths

---

## Phase 2: MongoDB Client Optimization

**Goal:** Refactor existing MongoDB client to use shared primitives.

MongoDB client already exists and works - this phase modernizes it to use the unified architecture.

### Current Bottlenecks

| Area | Issue | Solution |
|------|-------|----------|
| Buffer allocation | `Buffer.allocUnsafe()` per message | ConnectionWriter (single buffer) |
| Promise creation | New Promise per `sendAndWait()` | ContextDispatcher + callbacks |
| Sequential execution | One command per connection | Pipelining with ContextDispatcher |
| BSON encoding | Re-encode static command parts | MessageTemplate pattern |
| Type reflection | `getBSONDeserializer()` per response | Cache by type ID |

### Tasks

| ID | Task | Status | Notes |
|----|------|--------|-------|
| 2.1 | Replace buffer allocation with ConnectionWriter | - | Single buffer per connection |
| 2.2 | Replace Promise-per-command with ContextDispatcher | - | Breaking internal change |
| 2.3 | Implement connection pipelining | - | Multiple commands in flight |
| 2.4 | Apply MessageTemplate pattern to commands | - | Static BSON parts pre-encoded |
| 2.5 | Cache deserializers by response type | - | In Command base class |
| 2.6 | Optimize cursor batching (no array spread) | - | Minor |
| 2.7 | Benchmark all changes | - | Must show improvement |

### Architecture Change: Pipelining

**Current (Sequential):**
```
Client                    MongoDB
  |-- Find (id=1) -------->|
  |<-------- Response -----|
  |-- Find (id=2) -------->|
  |<-------- Response -----|
```

**New (Pipelined with ContextDispatcher):**
```
Client                    MongoDB
  |-- Find (ctx=1) ------->|
  |-- Find (ctx=2) ------->|
  |-- Find (ctx=3) ------->|
  |<------ Response (1) ---|
  |<------ Response (2) ---|
  |<------ Response (3) ---|

ContextDispatcher:
  slot[1] = callback for query 1
  slot[2] = callback for query 2
  slot[3] = callback for query 3

On response: dispatcher.dispatch(responseId, data)
```

### MessageTemplate for MongoDB Commands

MongoDB uses BSON, but commands have static structure:

```typescript
// Find command structure - static parts don't change
{
    find: "users",           // Static: collection name (per query type)
    $db: "mydb",             // Static: database name
    filter: { ... },         // Dynamic: query filter
    limit: 10,               // Dynamic: pagination
}

// Pre-encode static structure, insert dynamic BSON values
const findUsersTemplate = compileBsonTemplate({
    staticFields: { find: "users", $db: "mydb" },
    dynamicFields: ["filter", "limit", "skip", "sort"],
});
```

### Expected Gains
- 15-20% GC reduction (single buffer, no Promise allocations)
- 20-50% throughput increase (pipelining, latency-dependent)
- 10-15% encoding speedup (pre-encoded static BSON parts)

---

## Phase 3: SQL Adapter Unification

**Goal:** Eliminate ~1,400 lines of duplication across PostgreSQL/MySQL/SQLite adapters.

### Current Duplication

| Component | PG Lines | MySQL Lines | SQLite Lines | Duplicated |
|-----------|----------|-------------|--------------|------------|
| Connection | 180 | 175 | 190 | 90% |
| Connection Pool | 150 | 145 | 160 | 92% |
| Transaction | 80 | 85 | 75 | 90% |
| Persistence | 200 | 210 | 220 | 70% |
| Query Resolver | 150 | 155 | 160 | 65% |
| **Total** | 693 | 699 | 732 | **~70%** |

### Unified Architecture

```
packages/sql/src/
├── connection-pool.ts      # SQLConnectionPoolBase (shared)
├── connection.ts           # SQLConnectionBase (shared)
├── transaction.ts          # SQLTransactionBase (shared)
├── persistence.ts          # SQLPersistenceBase (template methods)
├── query-resolver.ts       # SQLQueryResolverBase (shared)
├── platform/
│   ├── platform.ts         # SQLPlatform interface
│   ├── postgres.ts         # PostgresPlatform (dialect-specific)
│   ├── mysql.ts            # MySQLPlatform
│   └── sqlite.ts           # SQLitePlatform
└── error-registry.ts       # Unified error handling

packages/postgres/src/
├── adapter.ts              # PostgresDatabaseAdapter (minimal)
├── connection.ts           # PostgresConnection extends SQLConnectionBase
└── platform.ts             # Re-exports from sql/platform/postgres.ts

packages/mysql/src/
└── (same minimal structure)

packages/sqlite/src/
└── (same minimal structure)
```

### Tasks

| ID | Task | Status | Notes |
|----|------|--------|-------|
| 3.1 | Create `SQLConnectionPoolBase` with hooks | - | Platform-specific: createConnection() |
| 3.2 | Create `SQLConnectionBase` | - | Platform-specific: execute(), prepare() |
| 3.3 | Create `SQLTransactionBase` | - | Platform-specific: isolation level syntax |
| 3.4 | Create `SQLPersistenceBase` with template methods | - | Platform-specific: SQL generation |
| 3.5 | Create `SQLPlatform` interface | - | Quoting, types, RETURNING, etc. |
| 3.6 | Create error handler registry | - | Per-platform error mapping |
| 3.7 | Migrate PostgreSQL to new base classes | - | First adapter |
| 3.8 | Migrate MySQL to new base classes | - | |
| 3.9 | Migrate SQLite to new base classes | - | |
| 3.10 | Shared test suite for all SQL adapters | - | Run same tests against all |

### Platform Interface

```typescript
interface SQLPlatform {
    name: string;

    // Quoting
    quoteIdentifier(name: string): string;
    quoteValue(value: any): string;

    // Types
    getColumnType(type: Type): string;
    getDefaultValue(type: Type): string;

    // Dialect
    supportsReturning(): boolean;
    getReturningClause(columns: string[]): string;
    getAutoIncrementKeyword(): string;
    getUpsertSQL(table: string, columns: string[], conflictKeys: string[]): string;

    // JSON
    getJsonExtractPath(column: string, path: string): string;

    // Errors
    isUniqueConstraintError(error: Error): boolean;
    isForeignKeyError(error: Error): boolean;
}
```

---

## Phase 4: Custom Database Clients

**Goal:** Direct protocol implementations for maximum performance.

### Design Philosophy: ORM-First, Not General-Purpose

**Critical:** These clients are **tightly coupled to the ORM adapter API**. They are NOT general-purpose database drivers.

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              ORM Layer                                   │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │  Expression Trees (Selector API)                                 │    │
│  │  • Cached, compiled queries                                      │    │
│  │  • Type-safe field references                                    │    │
│  │  • JIT-compiled serializers                                      │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                    │                                     │
│                                    ▼                                     │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │  Database Clients (this phase)                                   │    │
│  │  • Receive compiled MessageTemplates from ORM                    │    │
│  │  • Efficiently serialize/send                                    │    │
│  │  • Receive/deserialize responses                                 │    │
│  │  • NOT designed for raw SQL ergonomics                           │    │
│  └─────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────┘
```

**What this means:**

```typescript
// ❌ NOT the intended use case (unergonomic by design)
const client = new PostgresClient(config);
const users = await client.query('SELECT * FROM users WHERE id = $1', [1]);

// ✅ Intended use case - through ORM
const users = await db.query(User).filter({ id: 1 }).find();
// ORM compiles to MessageTemplate → Client executes efficiently

// ✅ Standalone use for testing (works, but not ergonomic)
const client = new PostgresClient(config);
const template = compileMessageTemplate(userSchema, selectExpression);
const users = await client.execute(template, { id: 1 });
```

**Why this design?**

1. **Performance:** ORM compiles query once, client reuses compiled template. No string parsing per query.

2. **Type safety:** Expression trees carry type information. Client deserializes directly to typed objects.

3. **No duplication:** Query building logic lives in ORM (Selector API), not reimplemented in each client.

4. **Caching:** Expression tree IDs enable query plan caching at both ORM and client level.

5. **Focus:** Client code is small, focused on protocol efficiency. No SQL parsing, no query building.

**Raw SQL escape hatch:**
```typescript
// Will exist, but deliberately unergonomic
const result = await db.raw<User[]>`SELECT * FROM users WHERE id = ${id}`;
// Uses tagged template for safety, but no JIT compilation, no caching
// Discouraged for hot paths
```

**Testing without full ORM:**
```typescript
// For unit/integration tests of the client itself
const client = new PostgresClient(config);
await client.connect();

// Low-level API exists but requires manual template construction
const template = {
    staticParts: [Buffer.from('SELECT 1')],
    dynamicSlots: [],
};
const result = await client.execute(template);
```

### Unified Binary Client Architecture

All custom clients share the same core patterns:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                       @deepkit/orm primitives                            │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌─────────────────┐  ┌──────────────────┐  ┌─────────────────────────┐ │
│  │ContextDispatcher│  │ ConnectionWriter │  │    MessageTemplate      │ │
│  │ (async tracking)│  │ (single buffer)  │  │    (static+dynamic)     │ │
│  └────────┬────────┘  └────────┬─────────┘  └────────────┬────────────┘ │
│           │                    │                         │              │
│           └────────────────────┼─────────────────────────┘              │
│                                ▼                                        │
│                    ┌───────────────────────┐                            │
│                    │   TopologyManager     │                            │
│                    ├───────────────────────┤                            │
│                    │ • Primary/Replica     │                            │
│                    │ • Read preferences    │                            │
│                    │ • Transaction routing │                            │
│                    │ • Health checking     │                            │
│                    │ • Connection pooling  │                            │
│                    └───────────┬───────────┘                            │
│                                │                                        │
└────────────────────────────────┼────────────────────────────────────────┘
                                 │
        ┌────────────────────────┼────────────────────────┐
        ▼                        ▼                        ▼
┌───────────────┐       ┌───────────────┐       ┌───────────────┐
│  PostgreSQL   │       │     MySQL     │       │     Redis     │
│    Client     │       │    Client     │       │    Client     │
├───────────────┤       ├───────────────┤       ├───────────────┤
│ Binary Proto  │       │ Binary Proto  │       │ RESP Proto    │
│ Pipelining ✓  │       │ Pipelining ✓  │       │ Pipelining ✓  │
│ Prepared Stmt │       │ Prepared Stmt │       │ Cluster/Sent. │
└───────────────┘       └───────────────┘       └───────────────┘
        │                        │                        │
        └────────────────────────┼────────────────────────┘
                                 ▼
                       ┌───────────────┐
                       │    MongoDB    │
                       │    Client     │
                       ├───────────────┤
                       │ OP_MSG Proto  │
                       │ Pipelining ✓  │
                       │ Replica Set   │
                       └───────────────┘
```

**Each client implements:**
1. Protocol-specific message encoding (using ConnectionWriter)
2. Protocol-specific response parsing
3. Pipelining via ContextDispatcher
4. JIT-compiled query templates (using MessageTemplate pattern)
5. TopologyManager integration for primary/replica routing

### 4.1 PostgreSQL Direct Client

**Source:** Started in `feature/orm-selector` (`packages/postgres/src/client.ts`, 1,959 lines skeleton)

**Protocol:** PostgreSQL Frontend/Backend Protocol v3

| Message Type | Direction | Purpose |
|--------------|-----------|---------|
| StartupMessage | F→B | Connection init |
| Query | F→B | Simple query |
| Parse/Bind/Execute | F→B | Extended query (prepared) |
| DataRow | B→F | Result row |
| CommandComplete | B→F | Query finished |
| ReadyForQuery | B→F | Can send next query |

**Pipelining support:** Yes - can send multiple queries before receiving responses.

**Tasks:**

| ID | Task | Status | Notes |
|----|------|--------|-------|
| 4.1.1 | Complete protocol message types | - | Parse, Bind, Execute, etc. |
| 4.1.2 | Implement authentication (MD5, SCRAM) | - | |
| 4.1.3 | Implement connection establishment | - | |
| 4.1.4 | Implement simple query mode | - | |
| 4.1.5 | Implement extended query mode (prepared) | - | |
| 4.1.6 | Implement pipelining with ContextDispatcher | - | |
| 4.1.7 | Connection pooling | - | |
| 4.1.8 | COPY protocol support | - | Bulk inserts |
| 4.1.9 | Benchmark vs. `pg` driver | - | |

### 4.2 MySQL Direct Client

**Protocol:** MySQL Client/Server Protocol

| Message Type | Direction | Purpose |
|--------------|-----------|---------|
| Handshake | S→C | Auth init |
| COM_QUERY | C→S | Text query |
| COM_STMT_PREPARE | C→S | Prepare statement |
| COM_STMT_EXECUTE | C→S | Execute prepared |
| ResultSet | S→C | Query results |

**Pipelining support:** Yes - similar to PostgreSQL.

**Tasks:**

| ID | Task | Status | Notes |
|----|------|--------|-------|
| 4.2.1 | Implement protocol message types | - | |
| 4.2.2 | Implement authentication (native, caching_sha2) | - | |
| 4.2.3 | Implement text protocol | - | |
| 4.2.4 | Implement binary protocol (prepared) | - | |
| 4.2.5 | Implement pipelining with ContextDispatcher | - | |
| 4.2.6 | Connection pooling | - | |
| 4.2.7 | Benchmark vs. `mysql2` driver | - | |

### 4.3 Redis Direct Client

**Protocol:** RESP (Redis Serialization Protocol)

RESP is text-based but binary-safe, making it simpler than SQL protocols:

```
*3\r\n        # Array of 3 elements
$3\r\n        # Bulk string, 3 bytes
SET\r\n       # "SET"
$3\r\n        # Bulk string, 3 bytes
key\r\n       # "key"
$5\r\n        # Bulk string, 5 bytes
value\r\n     # "value"
```

**Static + Dynamic Pattern for Redis:**
```typescript
// Pre-encoded command template for SET
const setTemplate = {
    staticParts: [
        Buffer.from('*3\r\n$3\r\nSET\r\n$'),  // Command prefix
        Buffer.from('\r\n'),                    // After key length
        Buffer.from('\r\n$'),                   // After key, before value length
        Buffer.from('\r\n'),                    // After value length
        Buffer.from('\r\n'),                    // After value
    ],
    dynamicSlots: [
        { afterStatic: 0, type: 'length' },    // Key length
        { afterStatic: 1, type: 'utf8' },      // Key
        { afterStatic: 2, type: 'length' },    // Value length
        { afterStatic: 3, type: 'buffer' },    // Value (binary-safe)
    ],
};
```

**Pipelining support:** Yes - Redis is designed for pipelining. Send N commands, receive N responses in order. Perfect fit for ContextDispatcher.

**Use cases in Deepkit:**
- `@deepkit/broker-redis` - Already exists, currently uses `ioredis`
- Session storage
- Cache layer
- Pub/Sub (broker)

**Tasks:**

| ID | Task | Status | Notes |
|----|------|--------|-------|
| 4.3.1 | Implement RESP encoder | - | Simple text protocol |
| 4.3.2 | Implement RESP decoder | - | Handle all RESP types |
| 4.3.3 | Implement pipelining with ContextDispatcher | - | |
| 4.3.4 | Connection pooling | - | |
| 4.3.5 | Pub/Sub support | - | Different response model |
| 4.3.6 | Cluster support | - | MOVED/ASK redirects |
| 4.3.7 | Benchmark vs. `ioredis` | - | |
| 4.3.8 | Migrate `@deepkit/broker-redis` to new client | - | |

---

## Phase 5: Selector API (New Query System)

**Goal:** Complete the expression-tree-based query API from `feature/orm-selector`.

### Current vs. New

```typescript
// Current: Fluent builder
await db.query(User)
    .filter({ name: 'Peter' })
    .innerJoinWith('posts')
    .find();

// New: Functional with expression trees
await db.query2((user: Select<User>) => {
    where(eq(user.name, 'Peter'));
    join(user.posts);
}).find();
```

### Benefits
1. **Type-safe field access** - `user.name` is typed proxy, not string
2. **Query caching** - Identical trees get same ID → cache compiled queries
3. **Extensible operations** - Register custom ops via Symbol registry
4. **Unified model** - Same SelectorState works for SQL and MongoDB

### Completion Status (from `feature/orm-selector`)

| Component | Status | Notes |
|-----------|--------|-------|
| Core selector API | ✅ Complete | 949 lines |
| Expression tree building | ✅ Complete | |
| MemoryDatabaseAdapter | ✅ Complete | Working with tests |
| SQL Builder Registry | ✅ Complete | |
| SQL Builder | ⚠️ 40% | Joins/aggregations incomplete |
| PostgreSQL SelectorResolver | ⚠️ 20% | Stub implementation |
| MySQL SelectorResolver | ❌ 0% | |
| SQLite SelectorResolver | ❌ 0% | |
| MongoDB SelectorResolver | ❌ 0% | |

### Tasks

| ID | Task | Status | Notes |
|----|------|--------|-------|
| 5.1 | Merge selector core from `feature/orm-selector` | - | select.ts, dql.spec.ts |
| 5.2 | Complete SQL joins implementation | - | Currently commented out |
| 5.3 | Implement GROUP BY / HAVING | - | |
| 5.4 | Implement subqueries | - | |
| 5.5 | PostgreSQL SelectorResolver | - | Full implementation |
| 5.6 | MySQL SelectorResolver | - | |
| 5.7 | SQLite SelectorResolver | - | |
| 5.8 | MongoDB SelectorResolver | - | Aggregation pipeline |
| 5.9 | Migration guide from Query to Query2 | - | |
| 5.10 | Deprecation path for old API | - | |

---

## Phase 6: RPC Protocol Rewrite

**Goal:** Merge `feat/better-rpc` improvements for zero-copy, binary-first RPC.

### Key Innovations (from `feat/better-rpc`)

1. **Binary message protocol** - 1-byte header with bitfields
2. **ContextDispatcher** - Already in Phase 0
3. **JIT-compiled action dispatchers** - Inline BSON deserializers

### Message Protocol

```
Current: Serialized message objects (BSON overhead)
New:     <flag(1)> [routeParams(17)] [contextId(2)] [actionId(2)] [body...]

Flag byte:
  bits 0-1: Route type (Client=00, Server=01, Direct=10)
  bits 2-3: Context type (None=00, New=01, Existing=10, End=11)
  bits 4-6: Message type (Ack=000, Error=001, Chunk=010, Action=011)
```

### Tasks

| ID | Task | Status | Notes |
|----|------|--------|-------|
| 6.1 | Merge binary protocol from `feat/better-rpc` | - | |
| 6.2 | Merge JIT action dispatcher | - | |
| 6.3 | Update RPC kernel | - | |
| 6.4 | Update client implementation | - | |
| 6.5 | Backward compatibility layer | - | Or document breaking change |
| 6.6 | Benchmark suite | - | |
| 6.7 | Update RPC tests | - | |

---

## Dependencies Graph

```
                    INFRASTRUCTURE LAYER (Phases 0-6)
═══════════════════════════════════════════════════════════════════

Prerequisite: Remove Buffer → Uint8Array (can be done incrementally)
    │
    ▼
Phase 0: Core Primitives (@deepkit/orm or @deepkit/db)
    │
    ├── 0.1 ContextDispatcher ──────────────────────┐
    ├── 0.2 ConnectionWriter ───────────────────────┤
    ├── 0.3 MessageTemplate ────────────────────────┤
    ├── 0.4 TopologyManager ────────────────────────┤
    ├── 0.5 Streaming (cursors, backpressure) ──────┤
    └── 0.6 @deepkit/bench (separate package) ──────┤
                                                    │
Phase 1: Benchmarks ◄───────────────────────────────┘
    │
    ├───────────────────┬───────────────────────────┐
    ▼                   ▼                           ▼
Phase 2: MongoDB    Phase 3: SQL Unify        Phase 6: RPC
(optimize existing)     │                      (binary protocol)
    │                   ▼
    │           Phase 4: Custom Clients
    │               ├── 4.1 PostgreSQL
    │               ├── 4.2 MySQL
    │               └── 4.3 Redis
    │                   │
    └───────────────────┼───────────────────────────┐
                        ▼                           │
                   Phase 5: Selector API ◄──────────┘


                    FRAMEWORK LAYER (Phases 7-11)
═══════════════════════════════════════════════════════════════════

Phase 7: Type System          Phase 8: HTTP/RPC         Phase 9: DI
├── Namespace types           ├── SSE                   ├── Lifecycle hooks
├── Missing validators        ├── Rate limiting         ├── Testing utils
├── Async validators          ├── Caching               ├── Lazy injection
├── Schema export             ├── OpenAPI               └── Debug tools
└── Error improvements        └── HTTP/2

                        │
                        ▼
Phase 10: Observability              Phase 11: Testing
├── OpenTelemetry                    ├── HTTP assertions
├── Prometheus metrics               ├── DB fixtures/factories
├── Health checks                    ├── Transaction isolation
└── Watch mode                       └── Benchmark regression


                    ECOSYSTEM LAYER (Phases 12-13)
═══════════════════════════════════════════════════════════════════

Phase 12: Frontend Integration       Phase 13: Future
├── Browser-safe types               ├── LLM validation
├── React integration                ├── Edge runtime
├── tRPC-like auto client            ├── Type-safe migrations
└── Vue/Svelte integration           └── DB introspection


All database clients use same primitives (from @deepkit/orm or @deepkit/db):
  - ContextDispatcher (pipelining, async tracking)
  - ConnectionWriter (single buffer per connection)
  - MessageTemplate (static+dynamic JIT compilation)
  - TopologyManager (primary/replica routing, transactions)
  - Streaming (cursors, backpressure, async iterators)
```

---

## Branch Strategy

| Phase | Branch | Merge Target |
|-------|--------|--------------|
| 0 | `feat/core-primitives` | `feat/next` |
| 1 | `feat/benchmarks` | `feat/next` |
| 2 | `feat/mongo-optimize` | `feat/next` |
| 3 | `feat/sql-unify` | `feat/next` |
| 4.1 | `feat/pg-client` | `feat/next` |
| 4.2 | `feat/mysql-client` | `feat/next` |
| 4.3 | `feat/redis-client` | `feat/next` |
| 5 | `feat/selector-api` | `feat/next` |
| 6 | `feat/rpc-v2` | `feat/next` |

---

## Success Metrics

| Package | Current Baseline | Target | Measurement |
|---------|------------------|--------|-------------|
| @deepkit/mongo | TBD ops/sec | +30% | Command throughput |
| @deepkit/postgres | TBD ops/sec | +50% | Query throughput (vs pg driver) |
| @deepkit/mysql | TBD ops/sec | +50% | Query throughput (vs mysql2) |
| @deepkit/redis | N/A (new) | +30% vs ioredis | Command throughput |
| @deepkit/rpc | TBD ops/sec | +100% | Action dispatch rate |
| @deepkit/type | 32M ops/sec | Maintain | Serialization |
| @deepkit/bson | 13x bson-js | Maintain | Encode/decode |

---

## Reference: Experimental Branches

### `feature/orm-selector`
- New query API (selector)
- PostgreSQL client skeleton (1,959 lines)
- Expression tree system
- **Status:** ~40% complete, paused

### `feat/better-rpc`
- Binary protocol
- ContextDispatcher
- JIT action dispatchers
- Benchmark system
- **Status:** ~70% complete

### Current `packages/mongo`
- Custom MongoDB client (production)
- Custom BSON (13x faster)
- **Status:** Production, optimization opportunities identified

---

---

## Phase 7: Type System Improvements

**Goal:** Expand TypeScript feature support, add missing validators, improve error messages.

### 7.1 Missing TypeScript Features

| Feature | Current State | Priority |
|---------|---------------|----------|
| Namespace access types (`Namespace.Type`) | Not supported | High |
| `keyof this` | Treated as `any` | Medium |
| Star imports (`import * as NS`) | Not supported | Medium |
| Enum literal types (`Enum.Member` as type) | Not supported | Medium |
| Template literal types | Partial | Low |
| Branded types at runtime | Not tracked | Low |

### 7.2 Validation Improvements

**Missing validators to add:**
- `URL` - URL validation
- `IP` / `IPv4` / `IPv6` - IP addresses
- `CreditCard` - Credit card numbers
- `PhoneNumber` - Phone formats
- `JSON` - Valid JSON strings
- `Slug` - URL-safe slugs
- `Semver` - Semantic versions
- `IBAN` / `BIC` - Banking identifiers
- `Latitude` / `Longitude` - Coordinates
- `NotEmpty` - Non-empty strings/arrays
- `Unique` - Array uniqueness

**Async validators:**
```typescript
// Enable database uniqueness checks, external API validation
type AsyncValidate<T extends AsyncValidateFunction> = ValidatorMeta<'asyncFunction', [T]>;

class User {
    email: string & Email & AsyncValidate<checkEmailUnique>;
}
```

**Conditional validation:**
```typescript
type Order = {
    paymentMethod: 'card' | 'cash';
    cardNumber: string & RequiredIf<'paymentMethod', 'card'>;
};
```

**Custom error messages:**
```typescript
type User = {
    email: string & Email & ErrorMessage<'Please enter a valid email'>;
};
```

### 7.3 Schema Export

Export `@deepkit/type` definitions to standard formats:

```typescript
import { toJsonSchema, toOpenApiSchema } from '@deepkit/type';

const jsonSchema = toJsonSchema<User>();
const openApiSchema = toOpenApiSchema<User>();
```

**Formats to support:**
- JSON Schema (draft 2020-12)
- OpenAPI 3.1 Schema
- GraphQL Schema (for GraphQL integration)

### 7.4 Error Message Improvements

**Union validation clarity:**
```
Expected: { type: 'click', x: number, y: number }
Got:      { type: 'click', x: 5 }
Missing:  y (number)
```

**Path breadcrumbs:**
```
user.address.city: Cannot convert undefined to string
```

**Actionable suggestions:**
```
DK-T100: Class User has no primary key
  → Add `id: number & PrimaryKey` to your class
  → Docs: https://deepkit.io/docs/orm/entities#primary-key
```

---

## Phase 8: HTTP/RPC Improvements

**Goal:** Production-ready HTTP features, real-time capabilities.

### 8.1 Server-Sent Events (SSE)

```typescript
@http.GET('/events')
async *streamEvents(): AsyncGenerator<SseEvent> {
    while (true) {
        yield { event: 'update', data: { time: Date.now() } };
        await sleep(1000);
    }
}

// Client receives type-safe events
```

### 8.2 Rate Limiting

```typescript
@http.controller()
class ApiController {
    @http.GET('/search')
    @rateLimit({ windowMs: 60000, max: 100 })  // 100 req/min
    search() {}
}

// Storage backends: in-memory, BrokerCache (distributed)
```

### 8.3 Response Caching

```typescript
@http.GET('/products/:id')
@cache({ ttl: 60, staleWhileRevalidate: 300 })
getProduct(id: number) {}

// Leverages existing BrokerCache
```

### 8.4 OpenAPI Generation

```typescript
import { generateOpenApiSpec } from '@deepkit/http';

const spec = generateOpenApiSpec(router);
// Full OpenAPI 3.1 spec generated from TypeScript types
// No separate schema definitions needed
```

### 8.5 HTTP/2 Support

```typescript
export class FrameworkConfig {
    http2: boolean = false;
    http2AllowHTTP1: boolean = true;
}
```

### 8.6 WebSocket Controllers (HTTP-level)

```typescript
@ws.controller('/chat')
class ChatController {
    @ws.onConnect()
    onConnect(connection: WsConnection) {}

    @ws.onMessage('chat')
    onMessage(message: ChatMessage, connection: WsConnection) {}
}
```

---

## Phase 9: Dependency Injection Improvements

**Goal:** Lifecycle management, testing utilities, debugging tools.

### 9.1 Lifecycle Hooks (Critical)

```typescript
interface Disposable {
    dispose(): void | Promise<void>;
}

// Provider configuration
{ provide: Database, useClass: Database, onDestroy: 'dispose' }

// Or with callback
{ provide: Database, useClass: Database, onDestroy: (db) => db.close() }
```

### 9.2 Testing Utilities (Critical)

```typescript
import { TestingModule } from '@deepkit/injector/testing';

const testModule = await TestingModule.create(MyModule)
    .mock(Database, { query: jest.fn() })
    .override({ provide: Logger, useValue: mockLogger })
    .compile();

const service = testModule.get(MyService);
```

### 9.3 Lazy Injection

```typescript
class MyService {
    constructor(private lazyDb: Lazy<Database>) {}

    async doWork() {
        const db = await this.lazyDb.get();  // Resolved on-demand
    }
}
```

### 9.4 Debug/Inspection Tools

```typescript
const graph = injector.getDependencyGraph();
const stats = injector.getStats();
const issues = injector.validate();  // Find missing providers without resolving
```

### 9.5 Conditional Providers

```typescript
{ provide: Logger, useClass: ConsoleLogger, when: () => isDev() },
{ provide: Logger, useClass: ProductionLogger, when: () => isProd() },
```

---

## Phase 10: Observability & Production Readiness

**Goal:** OpenTelemetry, metrics, health checks - production essentials.

### 10.1 OpenTelemetry Integration

```typescript
export class OpenTelemetryModule extends createModuleClass({
    config: {
        serviceName: 'my-app',
        exporter: 'otlp',  // or 'jaeger', 'zipkin'
        sampleRate: 1.0,
    },
}) {
    // Auto-instruments HTTP, RPC, ORM
    // Converts Stopwatch frames to OTEL spans
    // Propagates trace context across services
}
```

### 10.2 Prometheus Metrics

```typescript
export class MetricsModule extends createModuleClass({
    config: { path: '/metrics' },
}) {}

// Auto-registered metrics:
// - http_request_duration_seconds (histogram)
// - http_requests_total (counter by route/status)
// - rpc_calls_total
// - db_query_duration_seconds
// - active_connections (gauge)
```

### 10.3 Health Checks

```typescript
// Kubernetes-compatible endpoints
// /health/live - process alive
// /health/ready - dependencies ready

export class HealthModule extends createModuleClass({}) {
    registerCheck(name: string, check: () => Promise<boolean>): void;
}
```

### 10.4 Watch Mode (Development)

```typescript
server:start --watch  // File watching, hot reload
```

### 10.5 Error Tracking Integration

```typescript
// Sentry, Bugsnag, Rollbar adapters
export class ErrorTrackingModule extends createModuleClass({
    config: { dsn: '...' },
}) {}
```

---

## Phase 11: Testing Infrastructure

**Goal:** First-class testing utilities for HTTP, database, RPC.

### 11.1 HTTP Testing

```typescript
const response = await testApp.request(HttpRequest.GET('/users'));

response
    .expectStatus(200)
    .expectHeader('Content-Type', 'application/json')
    .expectJson<User[]>([{ id: 1, name: 'John' }]);
```

### 11.2 Database Testing

```typescript
// Transaction isolation - auto rollback after test
await testDb.withTransaction(async () => {
    await db.persist(user);
    // Test assertions...
});  // Automatically rolled back

// Fixtures
await testDb.loadFixtures(User, [
    { name: 'John', email: 'john@example.com' },
]);

// Factories
const userFactory = new Factory(User, () => ({
    name: faker.name(),
    email: faker.email(),
}));
const users = userFactory.makeMany(10);
```

### 11.3 RPC Testing

```typescript
const client = testApp.createRpcClient()
    .asUser(testSession)
    .mockAction('UserController', 'delete', { success: true });

await client.controller.getUser(1);
```

### 11.4 Benchmark Regression Testing

```typescript
const suite = new BenchmarkSuite()
    .add('serialization', () => serialize<User>(user))
    .add('validation', () => validate<User>(data));

const results = await suite.run();
suite.assertNoRegression(baseline, 0.1);  // Fail if >10% slower
```

---

## Phase 12: Frontend Integration

**Goal:** Full-stack type safety from browser to database.

### 12.1 Browser-Safe Type Package

```typescript
// @deepkit/type-browser or ensure @deepkit/type works in browser
// Share validation logic between frontend and backend
import { validate } from '@deepkit/type';

const errors = validate<CreateUserInput>(formData);
```

### 12.2 React Integration

```typescript
import { useDeepkitForm } from '@deepkit/type-react';

function UserForm() {
    const { register, errors, handleSubmit } = useDeepkitForm<CreateUser>();

    return (
        <form onSubmit={handleSubmit(onSubmit)}>
            <input {...register('email')} />
            {errors.email && <span>{errors.email.message}</span>}
        </form>
    );
}
```

### 12.3 tRPC-like Auto Client

```typescript
// Auto-generated from RPC controllers - no codegen step
import { createClient } from '@deepkit/rpc-client';

const api = createClient<typeof AppController>('ws://localhost:8080');

// Full type safety, autocomplete
const user = await api.user.getById(1);
```

---

## Phase 13: Future Opportunities

**Goal:** Leapfrog features for competitive differentiation.

### 13.1 LLM Structured Output Validation

```typescript
// Type-safe AI outputs
const response = await llm.generate<ResponseType>(prompt);
// Automatically validates, retries with errors as feedback

// Use Deepkit types as LLM output schemas
const schema = toLLMSchema<ExtractedData>();
```

### 13.2 Edge Runtime Support

- Cloudflare Workers
- Deno Deploy
- Vercel Edge Functions
- Bun

```typescript
// Zero-cold-start type validation at the edge
export default {
    async fetch(request: Request) {
        const body = validate<Input>(await request.json());
    }
};
```

### 13.3 Type-Safe Database Migrations

```typescript
// Generate migrations from type diffs
const migration = await db.generateMigration();

// Shows: "Add column 'email' to 'users' table"
// Safety check: "This migration is reversible"
```

### 13.4 Prisma-like Introspection

```typescript
// Generate types from existing database
npx deepkit db:introspect --output=./src/models.ts

// Supports brownfield projects migrating to Deepkit
```

---

## Prerequisite: JIT/CSP Compatibility (NEW)

**Document:** See `docs/todo/jit-csp/technical-spec.md` for complete design.

**The Problem:** Deepkit's performance depends on JIT compilation via `new Function()`, but this is blocked in:
- Cloudflare Workers (CSP restriction)
- Browsers with strict CSP (`script-src` without `'unsafe-eval'`)
- Some embedded JavaScript runtimes

**Solution:** Three-tier execution system:
1. **JIT** (current) - Maximum performance where `new Function()` works
2. **AOT** (build-time) - Pre-generate code at build time
3. **Interpreted** (fallback) - Runtime interpretation for maximum compatibility

**Impact:** Cuts across ALL packages that use `CompilerContext`:
- `@deepkit/type` - Serialization, validation
- `@deepkit/bson` - BSON encoding/decoding
- `@deepkit/injector` - DI factory generation
- `@deepkit/http` - Request parsing
- `@deepkit/workflow` - State machine compilation

**Expected Performance:**

| Strategy | Performance vs JIT | Use Case |
|----------|-------------------|----------|
| JIT | 100% (baseline) | Node.js, Deno, Bun |
| AOT | 95-100% | Production builds, Cloudflare Workers |
| Interpreted | 10-30% | Fallback, development |

**Related Tasks:**
- Add `RuntimeCapabilities` detection to `@deepkit/core`
- Create `ExecutionStrategy` interface
- Implement `InterpretedSerializer` in `@deepkit/type`
- Create `@deepkit/type-aot` package with CLI and build tool plugins
- Comprehensive benchmarking with `@deepkit/bench`

---

## Prerequisite: Remove Buffer Dependency

**Task:** Remove `Buffer` usage from entire codebase, replace with `Uint8Array` + `DataView`.

**Why:**
- `Buffer` is Node.js-specific, requires polyfill in browser/Bun/Deno
- `Uint8Array` + `DataView` are standard JS, work everywhere
- Modern Node.js has no performance advantage for `Buffer` over typed arrays
- Cleaner, more portable code

**Scope:**
- `@deepkit/bson` - Heavy Buffer usage for BSON encoding/decoding
- `@deepkit/mongo` - Client message serialization
- `@deepkit/type` - Some serialization paths
- `@deepkit/rpc` - Message encoding

**Approach:**
- Replace `Buffer.allocUnsafe(n)` → `new Uint8Array(n)`
- Replace `buffer.writeInt32LE(v, o)` → `view.setInt32(o, v, true)`
- Replace `Buffer.from(str)` → `new TextEncoder().encode(str)`
- Replace `buffer.toString()` → `new TextDecoder().decode(buffer)`
- Replace `buffer.copy(target, o)` → `target.set(buffer, o)`

**Status:** Not started (separate task, can be done incrementally)

---

## Open Questions

1. **Rename `@deepkit/orm` → `@deepkit/db`?**
   - "ORM" implies relational, but we handle MongoDB, Redis, etc.
   - `@deepkit/db` is more accurate for a unified database abstraction
   - Breaking change, but makes sense long-term
   - Could keep `@deepkit/orm` as re-export for backward compat

2. **Breaking changes in RPC?** Binary protocol is not backward compatible. Need migration strategy or major version bump.

3. **Selector API adoption path?** Keep both Query and Query2? Deprecation timeline?

3. **SQLite pipelining?** SQLite is synchronous. Use worker threads? Or accept it's different?

4. **Vector search?** `feature/orm-selector` has `l2Distance` op defined. Prioritize pgvector/MongoDB Atlas Search support?

---

## Changelog

| Date | Change |
|------|--------|
| 2026-01-20 | Added JIT/CSP compatibility prerequisite with link to `docs/todo/jit-csp/technical-spec.md` |
| 2026-01-20 | Initial document created from branch analysis |
| 2026-01-20 | Replaced BufferPool with ConnectionWriter (single buffer pattern) |
| 2026-01-20 | Added MessageTemplate pattern for static+dynamic message composition |
| 2026-01-20 | Added Redis client to Phase 4 |
| 2026-01-20 | Added unified binary client architecture diagram |
| 2026-01-20 | Added TopologyManager for primary/replica routing + unified transactions |
| 2026-01-20 | Documented ORM-first design philosophy for database clients |
| 2026-01-20 | Changed primitive location from @deepkit/core to @deepkit/orm |
| 2026-01-20 | Replaced Buffer with Uint8Array/DataView in all examples |
| 2026-01-20 | Added prerequisite task: Remove Buffer dependency from codebase |
| 2026-01-20 | Added streaming support (cursors, backpressure, change streams) |
| 2026-01-20 | Added Phase 7: Type system improvements (validators, async, schema export) |
| 2026-01-20 | Added Phase 8: HTTP/RPC improvements (SSE, rate limiting, caching, OpenAPI) |
| 2026-01-20 | Added Phase 9: DI improvements (lifecycle hooks, testing utils, lazy injection) |
| 2026-01-20 | Added Phase 10: Observability (OpenTelemetry, Prometheus, health checks) |
| 2026-01-20 | Added Phase 11: Testing infrastructure (assertions, fixtures, factories) |
| 2026-01-20 | Added Phase 12: Frontend integration (React, browser types, auto client) |
| 2026-01-20 | Added Phase 13: Future opportunities (LLM, edge, migrations) |
