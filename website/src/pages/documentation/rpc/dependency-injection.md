# Dependency Injection

## Understanding RPC Dependency Injection

Dependency Injection (DI) in RPC systems is more complex than in traditional applications because RPC controllers exist in a distributed context where each client connection represents a separate execution scope. Deepkit RPC integrates seamlessly with Deepkit's powerful DI system to provide scoped, type-safe dependency management across network boundaries.

### Why DI Matters in RPC

RPC controllers need access to various services and resources:

- **Business Logic Services**: User services, data repositories, external APIs
- **Connection-Specific Data**: Current user session, connection metadata
- **Shared Resources**: Database connections, caches, configuration
- **Request Context**: Authentication state, request tracing, logging context

Without proper DI, you'd have to manually wire these dependencies, leading to:
- Tight coupling between controllers and services
- Difficulty testing controllers in isolation
- Complex initialization code
- Poor separation of concerns

### RPC Scoping Model

Deepkit RPC uses a sophisticated scoping model to manage dependencies:

```
Application Scope (Singleton)
├── Database Connections
├── Configuration Services
├── External API Clients
└── Shared Caches

RPC Scope (Per Connection)
├── RpcKernelConnection
├── SessionState
├── RpcInjectorContext
├── ConnectionWriter
└── HttpRequest (optional)

Request Scope (Per Action Call)
├── Action-specific context
├── Request tracing
└── Temporary resources
```

### Available RPC Providers

When using the Deepkit Framework, RPC controllers automatically have access to these providers:

| Provider | Scope | Description |
|----------|-------|-------------|
| `RpcKernelConnection` | RPC | Current client connection |
| `SessionState` | RPC | Authentication and session data |
| `RpcInjectorContext` | RPC | DI context for the current connection |
| `ConnectionWriter` | RPC | Low-level connection writing |
| `HttpRequest` | RPC | HTTP request (WebSocket upgrade) - optional |

```typescript
import { RpcKernel, rpc } from '@deepkit/rpc';
import { App } from '@deepkit/app';
import { Database, User } from './database';

@rpc.controller('/main')
class Controller {
    constructor(private database: Database) {
    }

    @rpc.action()
    async getUser(id: number): Promise<User> {
        return await this.database.query(User).filter({ id }).findOne();
    }
}

new App({
    providers: [{ provide: Database, useValue: new Database }]
    controllers: [Controller],
}).run();
```

However, when an `RpcKernel` is manually instantiated, a DI Container can also be passed. The RPC Controller will then be instantiated through this DI Container. This is useful if you want to use `@deepkit/rpc` in a non-Deepkit Framework environment, like Express.js.

```typescript
import { RpcKernel, rpc } from '@deepkit/rpc';
import { InjectorContext } from '@deepkit/injector';
import { Database, User } from './database';

@rpc.controller('/main')
class Controller {
    constructor(private database: Database) {
    }

    @rpc.action()
    async getUser(id: number): Promise<User> {
        return await this.database.query(User).filter({ id }).findOne();
    }
}

const injector = InjectorContext.forProviders([
    Controller,
    { provide: Database, useValue: new Database },
]);
const kernel = new RpcKernel(injector);
kernel.registerController(Controller);
```

See [Dependency Injection](xref:dependency-injection.adoc) to learn more.
