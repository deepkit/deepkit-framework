# Package Reference Guide

This document provides a comprehensive reference for all packages in the Deepkit Framework, including their purpose, key exports, and usage patterns.

## Table of Contents

1. [Core Type System](#core-type-system)
2. [Dependency Injection](#dependency-injection)
3. [Application Framework](#application-framework)
4. [Communication](#communication)
5. [Data Layer](#data-layer)
6. [Infrastructure](#infrastructure)
7. [Build Tools](#build-tools)
8. [Angular Integration](#angular-integration)
9. [Debug Tools](#debug-tools)

---

## Core Type System

### @deepkit/type-spec

**Purpose:** Defines the ReflectionOp bytecode instruction set.

**Key Exports:**
- `ReflectionOp` - Enum of ~90 bytecode operations
- `TypeNumberBrand` - Number type variants (int8, uint32, float, etc.)
- `MappedModifier` - Modifiers for mapped types

**When to use:** Rarely used directly; imported by type-compiler and type packages.

---

### @deepkit/type-compiler

**Purpose:** TypeScript transformer that emits runtime type metadata.

**Key Exports:**
- `transformer` - Main TypeScript transformer
- `declarationTransformer` - Declaration file transformer

**Configuration:**
```json
// tsconfig.json
{
    "reflection": true
}
```

**Installation:** Automatically installs via `npm run postinstall`.

---

### @deepkit/type

**Purpose:** Runtime type reflection, validation, and serialization.

**Key Exports:**

| Export | Purpose |
|--------|---------|
| `typeOf<T>()` | Get runtime Type object |
| `cast<T>(value)` | Deserialize and validate |
| `serialize<T>(value)` | Serialize to JSON-safe format |
| `deserialize<T>(value)` | Deserialize from JSON |
| `validate<T>(value)` | Validate without casting |
| `ReflectionClass` | Class reflection wrapper |
| `ReflectionKind` | Type kind enum |
| `Type` | Base type interface |
| `ReceiveType<T>` | Type parameter receiver |
| `resolveReceiveType()` | Resolve received type |

**Type Annotations:**

| Annotation | Purpose |
|------------|---------|
| `PrimaryKey` | Mark as primary key |
| `AutoIncrement` | Auto-increment field |
| `Unique` | Unique constraint |
| `Index` | Database index |
| `MinLength<N>` | Minimum string length |
| `MaxLength<N>` | Maximum string length |
| `Minimum<N>` | Minimum number value |
| `Maximum<N>` | Maximum number value |
| `Positive` | Positive number |
| `Negative` | Negative number |
| `Email` | Email format |
| `Pattern<R>` | Regex pattern |

**Usage:**
```typescript
import { serialize, deserialize, validate, MinLength, Email } from '@deepkit/type';

interface User {
    name: string & MinLength<3>;
    email: string & Email;
}

const errors = validate<User>(data);
const json = serialize<User>(user);
const user = deserialize<User>(json);
```

---

## Dependency Injection

### @deepkit/injector

**Purpose:** JIT-compiled dependency injection container.

**Key Exports:**

| Export | Purpose |
|--------|---------|
| `Injector` | Base injector class |
| `InjectorContext` | Scoped injection context |
| `InjectorModule` | Module definition |
| `provide()` | Provider helper |
| `inject()` | Injection helper |

**Usage:**
```typescript
import { InjectorContext, InjectorModule } from '@deepkit/injector';

class MyModule extends InjectorModule {
    providers = [
        MyService,
        { provide: Logger, useClass: ConsoleLogger },
    ];
}

const context = InjectorContext.forModules([new MyModule()]);
const service = context.get(MyService);
```

**Scopes:**
- `singleton` - One instance per injector (default)
- `transient` - New instance each resolution
- `scoped` - One instance per scope

---

## Application Framework

### @deepkit/app

**Purpose:** Application container, CLI support, and module system.

**Key Exports:**

| Export | Purpose |
|--------|---------|
| `App` | Main application class |
| `AppModule` | Base module class |
| `createModule()` | Module factory |
| `cli` | CLI decorator |
| `Flag` | CLI flag annotation |

**Usage:**
```typescript
import { App, createModule, cli, Flag } from '@deepkit/app';

@cli.controller('greet')
class GreetCommand {
    execute(name: string, loud: boolean & Flag = false) {
        const msg = loud ? name.toUpperCase() : name;
        console.log(`Hello, ${msg}!`);
    }
}

const app = new App({
    controllers: [GreetCommand],
});

app.run();
```

**Configuration:**
```typescript
class AppConfig {
    database: string = 'localhost';
    debug: boolean = false;
}

const app = new App({ config: AppConfig });
app.loadConfigFromEnv({ prefix: 'APP_' });
```

---

### @deepkit/framework

**Purpose:** Full framework integrating HTTP, RPC, ORM, and debug tools.

**Key Exports:**

| Export | Purpose |
|--------|---------|
| `FrameworkModule` | Main framework module |
| `onServerBootstrap` | Server lifecycle event |
| `onServerShutdown` | Shutdown event |

**Usage:**
```typescript
import { App } from '@deepkit/app';
import { FrameworkModule } from '@deepkit/framework';

const app = new App({
    controllers: [UserController],
    imports: [new FrameworkModule({ debug: true })],
});

app.run(['server:start']);
```

---

## Communication

### @deepkit/http

**Purpose:** HTTP router with automatic serialization.

**Key Exports:**

| Export | Purpose |
|--------|---------|
| `HttpRouter` | Route registration |
| `HttpKernel` | Request handler |
| `http` | Route decorators |
| `HttpBody<T>` | Body parameter |
| `HttpQuery<T>` | Query parameter |
| `HttpRequest` | Request object |
| `HttpResponse` | Response object |

**Usage:**
```typescript
import { http, HttpBody } from '@deepkit/http';

class UserController {
    @http.GET('/users/:id')
    getUser(id: number): User {
        return this.db.query(User).filter({ id }).findOne();
    }

    @http.POST('/users')
    createUser(body: HttpBody<Omit<User, 'id'>>): User {
        return this.db.persist(new User(body));
    }
}
```

---

### @deepkit/rpc

**Purpose:** Binary RPC protocol with automatic serialization.

**Key Exports:**

| Export | Purpose |
|--------|---------|
| `RpcKernel` | Server kernel |
| `RpcClient` | Client class |
| `rpc` | Controller/action decorators |

**Usage:**

Server:
```typescript
import { rpc } from '@deepkit/rpc';

@rpc.controller('user')
class UserController {
    @rpc.action()
    getUser(id: number): User {
        return this.db.query(User).filter({ id }).findOne();
    }
}
```

Client:
```typescript
import { RpcClient } from '@deepkit/rpc';
import { RpcWebSocketClientAdapter } from '@deepkit/rpc-tcp';

const client = new RpcClient(new RpcWebSocketClientAdapter('ws://localhost:8811'));
const userController = client.controller<UserController>('user');
const user = await userController.getUser(1);
```

---

### @deepkit/rpc-tcp

**Purpose:** TCP and WebSocket transports for RPC.

**Key Exports:**

| Export | Purpose |
|--------|---------|
| `RpcTcpServer` | TCP server |
| `RpcWebSocketServer` | WebSocket server |
| `RpcTcpClientAdapter` | TCP client adapter |
| `RpcWebSocketClientAdapter` | WebSocket client adapter |

---

## Data Layer

### @deepkit/orm

**Purpose:** Database-agnostic ORM with identity map and unit of work.

**Key Exports:**

| Export | Purpose |
|--------|---------|
| `Database` | Database connection |
| `Query` | Query builder |
| `DatabaseSession` | Unit of work session |

**Usage:**
```typescript
import { Database } from '@deepkit/orm';
import { SQLiteDatabaseAdapter } from '@deepkit/sqlite';

const db = new Database(new SQLiteDatabaseAdapter('app.db'), [User, Post]);

// Query
const users = await db.query(User)
    .filter({ active: true })
    .orderBy('createdAt', 'desc')
    .limit(10)
    .find();

// Persist
const session = db.createSession();
session.add(new User('John'));
await session.commit();
```

---

### @deepkit/sql

**Purpose:** SQL query builder and adapter base.

**Key Exports:**
- `SQLDatabaseAdapter` - Base SQL adapter
- `SqlBuilder` - SQL query builder
- `SQLFilterBuilder` - WHERE clause builder

---

### @deepkit/bson

**Purpose:** High-performance BSON serialization.

**Key Exports:**

| Export | Purpose |
|--------|---------|
| `serializeBSON<T>()` | Serialize to BSON |
| `deserializeBSON<T>()` | Deserialize from BSON |
| `getBSONSerializer<T>()` | Get JIT serializer |
| `ObjectId` | MongoDB ObjectId |

**Usage:**
```typescript
import { serializeBSON, deserializeBSON } from '@deepkit/bson';

const buffer = serializeBSON<User>(user);
const user = deserializeBSON<User>(buffer);
```

---

### Database Adapters

| Package | Database | Key Export |
|---------|----------|------------|
| `@deepkit/postgres` | PostgreSQL | `PostgresDatabaseAdapter` |
| `@deepkit/mysql` | MySQL | `MySQLDatabaseAdapter` |
| `@deepkit/sqlite` | SQLite | `SQLiteDatabaseAdapter` |
| `@deepkit/mongo` | MongoDB | `MongoDatabaseAdapter` |

---

## Infrastructure

### @deepkit/broker

**Purpose:** Message broker and distributed cache.

**Key Exports:**

| Export | Purpose |
|--------|---------|
| `BrokerBus` | Pub/sub messaging |
| `BrokerQueue` | Message queue |
| `BrokerCache` | Distributed cache |
| `BrokerLock` | Distributed locking |
| `BrokerKeyValue` | Key-value store |

**Usage:**
```typescript
import { BrokerBus, BrokerCache } from '@deepkit/broker';

// Pub/Sub
const bus = new BrokerBus(adapter);
const channel = bus.channel<Event>('events');
await channel.subscribe(event => console.log(event));
await channel.publish({ type: 'user.created' });

// Cache
const cache = new BrokerCache(adapter);
const item = cache.item<User>('user:1', () => loadUser(1), { ttl: '5m' });
const user = await item.get();
```

---

### @deepkit/event

**Purpose:** Type-safe event dispatching.

**Key Exports:**

| Export | Purpose |
|--------|---------|
| `EventDispatcher` | Event dispatcher |
| `EventToken` | Event identifier |
| `DataEventToken` | Data event identifier |

**Usage:**
```typescript
import { EventDispatcher, DataEventToken } from '@deepkit/event';

const userCreated = new DataEventToken<User>('user.created');

dispatcher.listen(userCreated, async (event) => {
    console.log('User created:', event.data);
});

await dispatcher.dispatch(userCreated, user);
```

---

### @deepkit/workflow

**Purpose:** State machine workflows.

**Key Exports:**
- `createWorkflow()` - Workflow factory
- `Workflow` - Workflow instance
- `WorkflowEvent` - Base workflow event

---

### @deepkit/logger

**Purpose:** Structured logging.

**Key Exports:**

| Export | Purpose |
|--------|---------|
| `Logger` | Logger class |
| `LoggerInterface` | Logger interface |
| `ConsoleTransport` | Console output |
| `JSONTransport` | JSON output |

---

### @deepkit/stopwatch

**Purpose:** Performance profiling.

**Key Exports:**
- `Stopwatch` - Profiling entry point
- `StopwatchStore` - Frame storage
- `FrameCategory` - Frame categories

---

### @deepkit/filesystem

**Purpose:** Virtual filesystem abstraction.

**Key Exports:**
- `Filesystem` - Main filesystem class
- `FilesystemAdapter` - Adapter interface
- `FilesystemLocalAdapter` - Local filesystem
- `FilesystemMemoryAdapter` - In-memory filesystem

**Additional Adapters:**
- `@deepkit/filesystem-aws-s3` - AWS S3
- `@deepkit/filesystem-google` - Google Cloud Storage
- `@deepkit/filesystem-ftp` - FTP
- `@deepkit/filesystem-sftp` - SFTP

---

### @deepkit/template

**Purpose:** Server-side JSX templates.

**Key Exports:**
- `render()` - Render template
- `html()` - Raw HTML helper
- `escape()` - HTML escape

**Usage:**
```typescript
@http.GET('/')
async home() {
    return <Layout title="Home">
        <h1>Welcome</h1>
    </Layout>;
}
```

---

## Build Tools

### @deepkit/vite

**Purpose:** Vite plugin for type compiler.

**Usage:**
```typescript
// vite.config.ts
import { deepkitType } from '@deepkit/vite';

export default {
    plugins: [deepkitType()],
};
```

---

### @deepkit/bun

**Purpose:** Bun plugin for type compiler.

**Usage:**
```toml
# bunfig.toml
preload = ["@deepkit/bun"]
```

---

## Angular Integration

### @deepkit/type-angular

**Purpose:** Angular forms integration.

**Key Exports:**
- `TypedFormGroup` - Type-safe form group

**Usage:**
```typescript
const form = TypedFormGroup.fromEntityClass(User);
form.setValue(userData);
```

---

### @deepkit/angular-ssr

**Purpose:** Angular SSR with Deepkit.

**Key Exports:**
- `AngularModule` - Deepkit module
- `RequestHandler` - SSR handler

---

### @deepkit/desktop-ui

**Purpose:** Angular UI component library.

**Components:**
- Form inputs (text, checkbox, select, slider)
- Table with sorting/filtering
- Dialogs and overlays
- Layout components
- File browser

---

## Debug Tools

### @deepkit/framework-debug-api

**Purpose:** Debug API interfaces.

### @deepkit/framework-debug-gui

**Purpose:** Angular debug GUI.

**Features:**
- Performance profiler (flamegraph)
- HTTP route inspector
- RPC action explorer
- Module architecture view
- Configuration inspector
- Database browser
- Filesystem browser

**Access:** `http://localhost:8080/_debug/` (when debug mode enabled)

---

## Package Selection Guide

| Need | Package |
|------|---------|
| Type validation | `@deepkit/type` |
| Dependency injection only | `@deepkit/injector` |
| CLI application | `@deepkit/app` |
| HTTP API | `@deepkit/http` or `@deepkit/framework` |
| Real-time communication | `@deepkit/rpc` |
| Database access | `@deepkit/orm` + adapter |
| Message queue | `@deepkit/broker` |
| Event system | `@deepkit/event` |
| File storage | `@deepkit/filesystem` + adapter |
| Full framework | `@deepkit/framework` |
