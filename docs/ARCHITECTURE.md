# Deepkit Framework Architecture

This document provides a comprehensive technical overview of the Deepkit Framework architecture for developers and AI agents working on the codebase.

## Table of Contents

1. [Core Innovation: Runtime Types](#core-innovation-runtime-types)
2. [Type System Pipeline](#type-system-pipeline)
3. [Package Architecture](#package-architecture)
4. [Data Flow Diagrams](#data-flow-diagrams)
5. [JIT Compilation Strategy](#jit-compilation-strategy)
6. [Key Design Patterns](#key-design-patterns)

---

## Core Innovation: Runtime Types

### The Problem

TypeScript types are erased at compile time. This forces developers to:
- Define schemas multiple times (TypeScript interface + Zod schema + ORM entity + validator decorators)
- Use code generation or decorator-heavy patterns
- Maintain synchronization between multiple schema definitions

### The Solution

Deepkit's type-compiler is a **TypeScript transformer** that:
1. Reads TypeScript AST at compile time
2. Converts type information to **ReflectionOp bytecode**
3. Embeds bytecode as runtime-accessible metadata
4. A runtime **processor VM** executes bytecode to reconstruct Type objects

This enables a single TypeScript type definition to work everywhere: validation, serialization, database, HTTP, RPC, and dependency injection.

---

## Type System Pipeline

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           COMPILE TIME                                       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   TypeScript Source          TypeScript AST           ReflectionOp          │
│   ─────────────────  ───►   ───────────────  ───►    Bytecode              │
│                                                       (Packed arrays)       │
│   interface User {           ts.InterfaceDecl        ['...encoded ops']     │
│     id: number;              ├─ PropertySig                                 │
│     name: string;            │   └─ NumberKeyword                           │
│   }                          └─ PropertySig                                 │
│                                  └─ StringKeyword                           │
│                                                                              │
│   @deepkit/type-compiler transforms types to bytecode                       │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                            RUNTIME                                           │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   Packed Bytecode           Processor VM              Type Object           │
│   ───────────────  ───►    ───────────────  ───►     ───────────           │
│                                                                              │
│   [fn, 'encoded']           Execute ops              { kind: 'class',       │
│                             Stack-based VM             types: [...],        │
│                             ~90 operations             properties: [...] }  │
│                                                                              │
│   @deepkit/type/src/reflection/processor.ts                                 │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         JIT COMPILATION                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   Type Object              Template Registry         Optimized Function     │
│   ───────────  ───►       ──────────────────  ───►  ──────────────────     │
│                                                                              │
│   { kind: 'class',        Generate code for         function validate(v) { │
│     properties: [...] }    each type kind            if (typeof v.id !==   │
│                                                        'number') return err │
│                           CompilerContext.build()    ...                    │
│                                                      }                       │
│                                                                              │
│   Functions cached in Type's JIT container                                  │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### ReflectionOp Bytecode

Defined in `@deepkit/type-spec`, the bytecode consists of ~90 operations encoded as characters (charCode 33-126):

**Type Operations:**
- `never`, `any`, `unknown`, `void`, `object`
- `string`, `number`, `boolean`, `bigint`, `symbol`
- `null`, `undefined`, `literal`

**Structure Operations:**
- `class`, `classReference`, `classExtends`
- `property`, `propertySignature`, `method`, `methodSignature`
- `objectLiteral`, `indexSignature`

**Composite Operations:**
- `array`, `tuple`, `tupleMember`
- `union`, `intersection`
- `function`, `parameter`

**Control Flow:**
- `frame`, `moveFrame`, `return`
- `call`, `inline`, `jump`, `condition`

**Modifiers:**
- `optional`, `readonly`, `public`, `private`, `protected`

---

## Package Architecture

### Dependency Graph

```
                    ┌─────────────────┐
                    │  @deepkit/core  │  ← Utilities, CompilerContext, type guards
                    └────────┬────────┘
                             │
              ┌──────────────┼──────────────┐
              │              │              │
              ▼              ▼              ▼
    ┌─────────────────┐ ┌─────────────┐ ┌─────────────────┐
    │@deepkit/type-spec│ │@deepkit/event│ │@deepkit/stopwatch│
    │  (ReflectionOp)  │ │             │ │                 │
    └────────┬────────┘ └──────┬──────┘ └────────┬────────┘
             │                 │                  │
             ▼                 │                  │
    ┌─────────────────────┐    │                  │
    │@deepkit/type-compiler│   │                  │
    │  (TS transformer)    │   │                  │
    └────────┬────────────┘    │                  │
             │                 │                  │
             ▼                 │                  │
    ┌─────────────────────┐    │                  │
    │   @deepkit/type     │◄───┘                  │
    │  (Runtime types)    │                       │
    └────────┬────────────┘                       │
             │                                    │
    ┌────────┴────────────────────────────────────┤
    │                                             │
    ▼                                             │
┌─────────────────┐                               │
│ @deepkit/injector│ ← DI with type tokens        │
└────────┬────────┘                               │
         │                                        │
         ▼                                        │
┌─────────────────┐                               │
│  @deepkit/app   │ ← App container, CLI, config  │
└────────┬────────┘                               │
         │                                        │
    ┌────┴────┬─────────┬─────────┬──────────┐   │
    │         │         │         │          │   │
    ▼         ▼         ▼         ▼          ▼   │
┌───────┐ ┌───────┐ ┌───────┐ ┌───────┐ ┌────────┤
│@deepkit│ │@deepkit│ │@deepkit│ │@deepkit│ │@deepkit│
│ /http │ │ /rpc  │ │ /orm  │ │/broker│ │/logger │◄┘
└───┬───┘ └───┬───┘ └───┬───┘ └───────┘ └────────┘
    │         │         │
    │         │    ┌────┴────┬─────────┬─────────┐
    │         │    │         │         │         │
    │         │    ▼         ▼         ▼         ▼
    │         │ ┌───────┐ ┌───────┐ ┌───────┐ ┌───────┐
    │         │ │@deepkit│ │@deepkit│ │@deepkit│ │@deepkit│
    │         │ │/postgres│ │ /mysql │ │/sqlite │ │ /mongo │
    │         │ └─────────┘ └────────┘ └────────┘ └────────┘
    │         │
    └────┬────┘
         │
         ▼
┌─────────────────────┐
│ @deepkit/framework  │ ← Full framework: HTTP + RPC + ORM + Debug
└─────────────────────┘
```

### Package Categories

**Core Type System:**
| Package | Purpose | Key Exports |
|---------|---------|-------------|
| `@deepkit/type-spec` | Bytecode definitions | `ReflectionOp`, `TypeNumberBrand` |
| `@deepkit/type-compiler` | TS transformer | `transformer`, `declarationTransformer` |
| `@deepkit/type` | Runtime reflection | `cast`, `validate`, `serialize`, `ReflectionClass` |

**Dependency Injection:**
| Package | Purpose | Key Exports |
|---------|---------|-------------|
| `@deepkit/injector` | DI container | `Injector`, `InjectorModule`, `InjectorContext` |

**Application Framework:**
| Package | Purpose | Key Exports |
|---------|---------|-------------|
| `@deepkit/app` | App container | `App`, `AppModule`, `cli` decorator |
| `@deepkit/framework` | Full framework | `FrameworkModule`, application server |

**Communication:**
| Package | Purpose | Key Exports |
|---------|---------|-------------|
| `@deepkit/http` | HTTP router | `HttpRouter`, `HttpKernel`, `@http` decorator |
| `@deepkit/rpc` | Binary RPC | `RpcKernel`, `RpcClient`, `@rpc` decorator |
| `@deepkit/rpc-tcp` | TCP/WebSocket | `RpcTcpServer`, `RpcWebSocketServer` |

**Data Layer:**
| Package | Purpose | Key Exports |
|---------|---------|-------------|
| `@deepkit/orm` | Database ORM | `Database`, `Query`, `DatabaseSession` |
| `@deepkit/sql` | SQL adapter | `SQLDatabaseAdapter`, `SqlBuilder` |
| `@deepkit/bson` | BSON codec | `serialize`, `deserialize`, `getBSONSerializer` |
| `@deepkit/mongo` | MongoDB | `MongoDatabaseAdapter` |
| `@deepkit/postgres` | PostgreSQL | `PostgresDatabaseAdapter` |
| `@deepkit/mysql` | MySQL | `MySQLDatabaseAdapter` |
| `@deepkit/sqlite` | SQLite | `SQLiteDatabaseAdapter` |

**Infrastructure:**
| Package | Purpose | Key Exports |
|---------|---------|-------------|
| `@deepkit/broker` | Message broker | `BrokerBus`, `BrokerQueue`, `BrokerCache` |
| `@deepkit/event` | Event system | `EventDispatcher`, `EventToken` |
| `@deepkit/workflow` | State machine | `createWorkflow`, `Workflow` |
| `@deepkit/logger` | Logging | `Logger`, `ConsoleTransport` |
| `@deepkit/stopwatch` | Profiling | `Stopwatch`, `StopwatchStore` |
| `@deepkit/filesystem` | File abstraction | `Filesystem`, `FilesystemAdapter` |
| `@deepkit/template` | JSX templates | `render`, `html`, `escape` |

**Build Tools:**
| Package | Purpose | Key Exports |
|---------|---------|-------------|
| `@deepkit/vite` | Vite plugin | `deepkitType` |
| `@deepkit/bun` | Bun plugin | `deepkitType` |

**Angular Integration:**
| Package | Purpose | Key Exports |
|---------|---------|-------------|
| `@deepkit/type-angular` | Form integration | `TypedFormGroup` |
| `@deepkit/angular-ssr` | SSR support | `AngularModule`, `RequestHandler` |
| `@deepkit/desktop-ui` | UI components | Form, Table, Dialog components |

---

## Data Flow Diagrams

### HTTP Request Flow

```
HTTP Request
     │
     ▼
┌─────────────────────────────────────────────────────────────────┐
│ HttpKernel.handleRequest()                                       │
│                                                                  │
│  1. Create stopwatch frame (FrameCategory.http)                  │
│  2. Dispatch httpWorkflow                                        │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ HTTP Workflow States                                         ││
│  │                                                              ││
│  │  start → request → route ─┬─► routeNotFound                 ││
│  │                           │                                  ││
│  │                           └─► auth ─┬─► accessDenied        ││
│  │                                     │                        ││
│  │                                     └─► resolveParameters   ││
│  │                                              │                ││
│  │                                     ┌───────┴───────┐        ││
│  │                                     │               │        ││
│  │                                     ▼               ▼        ││
│  │                              controller    parametersFailed ││
│  │                                     │                        ││
│  │                              ┌──────┴──────┐                 ││
│  │                              │             │                 ││
│  │                              ▼             ▼                 ││
│  │                          response   controllerError         ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                  │
│  3. Type-safe parameter deserialization via @deepkit/type        │
│  4. Controller method invocation with DI                         │
│  5. Response serialization                                       │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
     │
     ▼
HTTP Response
```

### ORM Query Flow

```
Query<User>.filter({name: 'John'}).find()
     │
     ▼
┌─────────────────────────────────────────────────────────────────┐
│ Query Builder                                                    │
│                                                                  │
│  1. Build DatabaseQueryModel from method chain                   │
│  2. Clone query on each method (immutable)                       │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────────────────────────────────┐
│ SQL Builder (for SQL databases)                                  │
│                                                                  │
│  1. Convert filter to WHERE clause (SQLFilterBuilder)            │
│  2. Handle joins, sorting, pagination                            │
│  3. Generate parameterized SQL                                   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────────────────────────────────┐
│ Database Adapter                                                 │
│                                                                  │
│  1. Execute SQL via driver (pg, mysql2, better-sqlite3)          │
│  2. Return raw rows                                              │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────────────────────────────────┐
│ Formatter (Hydration)                                            │
│                                                                  │
│  1. Convert rows to entity instances                             │
│  2. Handle relations (eager/lazy loading)                        │
│  3. Register in Identity Map                                     │
│  4. Create snapshots for change detection                        │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
     │
     ▼
User[] (typed, tracked entities)
```

### Dependency Injection Flow

```
class UserService {
  constructor(private db: Database, private logger: Logger) {}
}
     │
     ▼
┌─────────────────────────────────────────────────────────────────┐
│ Type Compiler (Build Time)                                       │
│                                                                  │
│  1. Extract constructor parameter types                          │
│  2. Emit type metadata as bytecode                               │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────────────────────────────────┐
│ InjectorModule Registration                                      │
│                                                                  │
│  1. Module registers providers                                   │
│  2. Export declarations control visibility                       │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────────────────────────────────┐
│ InjectorContext Build                                            │
│                                                                  │
│  1. Process all modules                                          │
│  2. Resolve provider dependencies                                │
│  3. JIT compile factory functions                                │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────────────────────────────────┐
│ Instance Resolution                                              │
│                                                                  │
│  injector.get(UserService)                                       │
│                                                                  │
│  1. Look up provider by type token                               │
│  2. Execute compiled factory                                     │
│  3. Recursively resolve dependencies                             │
│  4. Cache singleton instances                                    │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
     │
     ▼
UserService instance (with dependencies injected)
```

---

## JIT Compilation Strategy

### Why JIT?

Deepkit achieves extreme performance through JIT (Just-In-Time) compilation:
- Validators, serializers, and DI factories are generated as optimized JavaScript
- Generated code avoids reflection overhead at runtime
- Functions are cached per-type to avoid regeneration

### CompilerContext Pattern

```typescript
// packages/core/src/compiler.ts

class CompilerContext {
    context: Map<string, any> = new Map();  // Variables accessible in generated code

    reserveConst(value: any, name?: string): string {
        // Returns same variable name for same value (caching)
    }

    reserveVariable(name?: string, value?: any): string {
        // Reserves unique variable name
    }

    build(code: string, ...args: string[]): Function {
        // Compiles code string to function
        return new Function(...args, code);
    }
}
```

### Template Registry Pattern

Each subsystem (serializer, validator, BSON) uses template registries:

```typescript
// Simplified from packages/type/src/serializer.ts

class Serializer {
    serializeRegistry = new TemplateRegistry<SerializeFunction>();
    deserializeRegistry = new TemplateRegistry<DeserializeFunction>();

    // Register templates for each type kind
    constructor() {
        this.serializeRegistry.register(ReflectionKind.string, (type, state) => {
            state.addCode(`${state.setter} = ${state.accessor};`);
        });

        this.serializeRegistry.register(ReflectionKind.class, (type, state) => {
            // Generate code for class serialization
        });
    }
}
```

### Caching Strategy

JIT-compiled functions are cached in the type's container:

```typescript
// packages/type/src/reflection/type.ts

function getTypeJitContainer(type: Type): TypeJitContainer {
    return type.__jit || (type.__jit = {});
}

// Usage in serializer
const container = getTypeJitContainer(type);
if (!container.serialize) {
    container.serialize = compiler.build(generatedCode);
}
return container.serialize;
```

---

## Key Design Patterns

### 1. ReceiveType Pattern

Pass type information to functions at runtime:

```typescript
// Definition
function validate<T>(value: unknown, type?: ReceiveType<T>): ValidationError[] {
    const resolvedType = resolveReceiveType(type);
    return runValidation(resolvedType, value);
}

// Usage - type compiler injects metadata
validate<User>(data);  // Type info passed automatically
```

### 2. Type Annotations (Intersection Types)

Add constraints to types using intersections:

```typescript
type Username = string & MinLength<3> & MaxLength<20> & Unique;

class User {
    id: number & PrimaryKey & AutoIncrement = 0;
    username: Username = '';
    email: string & Email = '';
}
```

### 3. Workflow Pattern

State machine for request processing:

```typescript
const myWorkflow = createWorkflow('my-workflow', {
    start: WorkflowEvent,
    processing: ProcessingEvent,
    success: SuccessEvent,
    error: ErrorEvent,
}, {
    start: 'processing',
    processing: ['success', 'error'],
});

// Listen to state transitions
dispatcher.listen(myWorkflow.onProcessing, async (event) => {
    try {
        await doWork();
        event.next('success');
    } catch (e) {
        event.next('error', new ErrorEvent(e));
    }
});
```

### 4. Module Composition

Hierarchical module system:

```typescript
class DatabaseModule extends createModuleClass({
    config: DatabaseConfig,
    providers: [Database, MigrationRunner],
    exports: [Database],
}) {}

class AppModule extends createModuleClass({
    imports: [DatabaseModule],
    config: AppConfig,
}) {
    process() {
        // Configure imported modules based on app config
        this.getImportedModuleByClass(DatabaseModule)
            .configure(this.config.database);
    }
}
```

### 5. Event-Driven Architecture

Typed events with dependency injection:

```typescript
const userCreated = new DataEventToken<User>('user.created');

class UserListener {
    @eventDispatcher.listen(userCreated)
    async onUserCreated(event: typeof userCreated.event, mailer: Mailer) {
        await mailer.sendWelcome(event.data);
    }
}
```

---

## Performance Characteristics

Deepkit achieves high performance through architectural choices rather than micro-optimizations:
1. JIT compilation eliminates runtime type reflection
2. Generated code uses optimal paths for each type
3. Bytecode format is compact and fast to process
4. Monomorphic optimization via `toFastProperties()`
