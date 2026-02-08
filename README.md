<div align="center">
  <img src="https://deepkit.io/assets/images/deepkit_logo.svg" alt="Deepkit Logo" width="200">
  <h1>Deepkit Framework</h1>
  <p><strong>The unified high-performance TypeScript stack</strong></p>

  <a href="https://www.npmjs.com/package/@deepkit/type"><img alt="npm" src="https://img.shields.io/npm/v/@deepkit/type.svg" /></a>
  <a href="https://discord.gg/U24mryk7Wq"><img alt="Discord" src="https://img.shields.io/discord/759513055117180999?label=Discord" /></a>
  <a href="https://github.com/deepkit/deepkit-framework/actions/workflows/main.yml"><img alt="CI" src="https://github.com/deepkit/deepkit-framework/actions/workflows/main.yml/badge.svg" /></a>
  <a href="https://opensource.org/licenses/MIT"><img alt="License" src="https://img.shields.io/badge/License-MIT-blue.svg" /></a>
</div>

---

**Deepkit is a complete TypeScript application stack** — from HTTP and RPC to database and messaging — where every component is designed to work together seamlessly. No glue code. No schema duplication. No impedance mismatch. Just TypeScript from top to bottom.

## Why Deepkit?

### The Integration Problem

Modern TypeScript backends are assembled from disconnected parts: Express for HTTP, Prisma for database, Zod for validation, class-transformer for serialization, typedi for DI. Each library has its own schema format, its own conventions, and its own bugs to work around.

You become the integration layer. You write converters between Zod and Prisma schemas. You maintain decorators for your DI container. You debug subtle type mismatches between libraries that don't know about each other.

```typescript
// The typical TypeScript backend: 4 schema definitions for 1 entity
interface User { ... }                    // TypeScript type
const UserSchema = z.object({ ... });     // Zod validation
@Entity() class UserEntity { ... }        // TypeORM database
class UserDto { @IsEmail() email; }       // class-validator HTTP
```

### The Deepkit Solution

One type definition. One stack. Everything works together.

```typescript
import { PrimaryKey, AutoIncrement, Email, MinLength } from '@deepkit/type';

class User {
  id: number & PrimaryKey & AutoIncrement = 0;
  email: string & Email = '';
  createdAt: Date = new Date();

  constructor(public username: string & MinLength<3>) {}
}

// This single class works everywhere:
// - HTTP request/response validation and serialization
// - Database schema, queries, and migrations
// - RPC type-safe remote calls
// - Dependency injection tokens
// - Event payloads
// - CLI argument parsing
```

## Core Capabilities

### Runtime Type System

TypeScript types preserved at runtime via a compiler plugin:

```typescript
import { cast, validate, serialize, typeOf } from '@deepkit/type';

interface User {
  id: number;
  registered: Date;
  username: string;
}

// Deserialize JSON to typed objects (strings become Dates, etc.)
const user = cast<User>({
  id: 1,
  registered: '2024-01-15T10:30:00Z',
  username: 'peter'
});
user.registered instanceof Date; // true

// Validate against type constraints
validate<User>({ id: 'not a number' });
// [{ path: 'id', message: 'Not a number' }]

// Serialize to JSON-safe output
serialize<User>(user);
// { id: 1, registered: '2024-01-15T10:30:00.000Z', username: 'peter' }
```

### Integrated HTTP Layer

Types flow through the entire request/response cycle:

```typescript
import { App } from '@deepkit/app';
import { FrameworkModule } from '@deepkit/framework';
import { http, HttpBody } from '@deepkit/http';
import { MinLength, Positive, Email, PrimaryKey, AutoIncrement } from '@deepkit/type';

class User {
  id: number & PrimaryKey & AutoIncrement = 0;
  createdAt: Date = new Date();

  constructor(
    public username: string & MinLength<3>,
    public email: string & Email
  ) {}
}

class UserController {
  constructor(private db: Database) {}  // Injected automatically

  @http.GET('/user/:id')
  async get(id: number & Positive): Promise<User> {
    return this.db.query(User).filter({ id }).findOne();
  }

  @http.POST('/user')
  async create(body: HttpBody<Pick<User, 'username' | 'email'>>): Promise<User> {
    const user = new User(body.username, body.email);
    await this.db.persist(user);
    return user;
  }
}

new App({
  controllers: [UserController],
  imports: [new FrameworkModule({ debug: true })]
}).run();
```

### Zero-Decorator Dependency Injection

Types are injection tokens. No `@Injectable()`, no `@Inject()`:

```typescript
class UserService {
  constructor(
    private db: Database,
    private logger: Logger,
    private config: AppConfig
  ) {}
}
// Just works. The DI container uses TypeScript types directly.
```

### Type-First ORM

Database schema inferred from types. Queries are type-safe:

```typescript
const db = new Database(new SQLiteDatabaseAdapter('app.db'), [User, Post]);

// Type-safe queries with autocompletion
const users = await db.query(User)
  .filter({ email: { $like: '%@example.com' } })
  .orderBy('createdAt', 'desc')
  .limit(10)
  .find();

// Unit of work pattern
const session = db.createSession();
session.add(new User('alice', 'alice@example.com'));
session.add(new User('bob', 'bob@example.com'));
await session.commit();  // Single transaction
```

### Binary RPC

Type-safe communication between services with automatic serialization:

```typescript
// Shared interface (in common package)
interface UserControllerInterface {
  getUser(id: number): Promise<User>;
  createUser(data: Pick<User, 'username' | 'email'>): Promise<User>;
}

// Server
@rpc.controller('user')
class UserController implements UserControllerInterface {
  async getUser(id: number) { return this.db.query(User).filter({ id }).findOne(); }
  async createUser(data) { return this.db.persist(new User(data.username, data.email)); }
}

// Client - full type safety, autocompletion, and automatic serialization
const client = new RpcClient(new RpcWebSocketClientAdapter('ws://localhost:8811'));
const controller = client.controller<UserControllerInterface>('user');
const user = await controller.getUser(1);  // Returns typed User object
```

## Performance

Deepkit is engineered for performance at every level:

- **JIT Compilation**: Type operations compile to optimized JavaScript at runtime
- **Custom Drivers**: Own MongoDB driver and BSON parser, not wrappers around slow libraries
- **Zero Overhead DI**: Dependency injection generates direct constructor calls
- **Efficient Wire Protocol**: Binary RPC with BSON, not JSON text parsing

### Development Speed

Performance isn't just runtime. Deepkit accelerates development:

- **Single schema source** — No sync issues between type definitions
- **Automatic validation** — Types enforce constraints, no manual checking
- **Integrated debugging** — Built-in profiler and debug GUI at `/_debug/`
- **Hot reload friendly** — Watch mode with incremental compilation

### Perfect for AI-Assisted Development

Deepkit's unified type system makes it ideal for agentic coding with tools like Claude Code:

- **Predictable patterns** — One way to do things, not many library conventions to learn
- **Type-driven** — AI can understand intent from types alone
- **Self-documenting** — Types carry their own validation and serialization rules
- **Less glue code** — AI doesn't need to write integration boilerplate

## Quick Start

```bash
npm init @deepkit/app@latest my-app
cd my-app
npm start
```

## The Stack

**Core**
- `@deepkit/type` — Runtime type system, validation, serialization
- `@deepkit/type-compiler` — TypeScript transformer
- `@deepkit/injector` — Dependency injection
- `@deepkit/app` — Application container and CLI

**Web**
- `@deepkit/http` — HTTP router with automatic serialization
- `@deepkit/rpc` — Binary RPC protocol
- `@deepkit/framework` — Full framework integrating all components

**Data**
- `@deepkit/orm` — Database-agnostic ORM with identity map and unit of work
- `@deepkit/bson` — High-performance BSON serialization
- `@deepkit/postgres`, `@deepkit/mysql`, `@deepkit/sqlite` — SQL adapters
- `@deepkit/mongo` — Custom MongoDB driver (not a wrapper)

**Infrastructure**
- `@deepkit/broker` — Message broker, queues, distributed cache, locks
- `@deepkit/filesystem` — Virtual filesystem (local, S3, GCS, FTP)
- `@deepkit/event` — Type-safe event dispatching
- `@deepkit/workflow` — State machine workflows
- `@deepkit/logger` — Structured logging

**Tooling**
- `@deepkit/vite` — Vite plugin for type compiler
- `@deepkit/bun` — Bun plugin for type compiler
- Debug GUI — Performance profiler, route inspector, database browser

[View all 40+ packages →](https://deepkit.io/documentation/packages)

## Documentation

- [Introduction](https://deepkit.io/documentation/introduction)
- [Runtime Types](https://deepkit.io/documentation/runtime-types)
- [Dependency Injection](https://deepkit.io/documentation/dependency-injection)
- [HTTP](https://deepkit.io/documentation/http)
- [ORM](https://deepkit.io/documentation/orm)
- [RPC](https://deepkit.io/documentation/rpc)

## Community Packages

- [OpenAPI](https://github.com/hanayashiki/deepkit-openapi) — Automatic OpenAPI doc and Swagger UI generation
- [Serverless Adapter](https://github.com/H4ad/serverless-adapter) — Run on AWS Lambda, Azure, Digital Ocean
- [REST](https://github.com/deepkit-rest/rest) — Declarative REST API development
- [Stripe](https://github.com/deepkit-community/modules/tree/master/packages/stripe) — Stripe API and webhook integration
- [GraphQL](https://github.com/marcus-sa/deepkit-graphql/tree/main/packages/core) — GraphQL server support
- [Apollo Server](https://github.com/marcus-sa/deepkit-graphql/tree/main/packages/apollo) — Apollo integration
- [Remix](https://github.com/marcus-sa/deepkit-modules/tree/main/packages/remix) — Remix framework integration
- [Nx Webpack Plugin](https://github.com/marcus-sa/deepkit-modules/tree/main/packages/nx-webpack-plugin) — Nx build tool integration

## Examples

- [Full Application](https://github.com/deepkit/deepkit-framework/blob/master/packages/example-app/app.ts) — HTTP, RPC, CLI, and ORM
- [Minimal HTTP Server](https://github.com/deepkit/deepkit-framework/blob/master/packages/example-app/slim.ts) — HTTP router without full framework
- [Bookstore](https://github.com/marcj/deepkit-bookstore) — REST CRUD API with API Console
- [Webpack](https://github.com/marcj/deepkit-webpack) — Type compiler with Webpack
- [GraphQL + ORM](https://github.com/marcus-sa/deepkit-graphql/tree/main/examples/orm-integration) — GraphQL server with ORM
- [Angular SSR](https://github.com/marcus-sa/deepkit-angular-template) — Angular SSR with RPC

## Contributing

See [DEVELOPMENT.md](./DEVELOPMENT.md) for setup instructions.

```bash
git clone https://github.com/deepkit/deepkit-framework.git
cd deepkit-framework
npm install
npm run postinstall  # Required: builds the type compiler
npm run build
```

## License

MIT
