# Scopes

Scopes control the lifecycle of service instances in the dependency injection container. By default, all providers are **singletons** - instantiated once and reused throughout the application lifetime. However, many real-world scenarios require different lifecycles.

## Why Scopes Matter

Consider these scenarios:
- **HTTP Request**: User session, request context, and request-specific data should be isolated per request
- **RPC Call**: Each remote procedure call should have its own context and state
- **CLI Command**: Command-specific configuration and state
- **Database Transaction**: Services that need to share a database transaction

Scopes provide a way to create isolated dependency injection contexts for these scenarios.

## Scope Basics

### Global Scope (Default)

All providers without a scope specification live in the global scope:

```typescript
class Database {
    connect() { /* ... */ }
}

class UserRepository {
    constructor(private db: Database) {}
}

// Both are global singletons
const injector = Injector.from([Database, UserRepository]);

const repo1 = injector.get(UserRepository);
const repo2 = injector.get(UserRepository);
console.log(repo1 === repo2); // true - same instance
```

### Scoped Providers

To create a scoped provider, specify the scope name:

```typescript
import { InjectorContext } from '@deepkit/injector';

class UserSession {
    constructor(public userId?: string) {}
}

class RequestLogger {
    private logs: string[] = [];

    log(message: string) {
        this.logs.push(`${new Date().toISOString()}: ${message}`);
    }

    getLogs() {
        return this.logs;
    }
}

const injector = InjectorContext.forProviders([
    { provide: UserSession, scope: 'http' },
    { provide: RequestLogger, scope: 'http' }
]);
```

**Important**: Once a provider is scoped, it cannot be obtained directly from the global injector:

```typescript
// This will throw an error
const session = injector.get(UserSession);
// Error: Service 'UserSession' is known but is not available in scope global
```

## Creating Scoped Containers

To access scoped providers, create a child scope:

```typescript
// Create a new HTTP scope (typically done per request)
const httpScope = injector.createChildScope('http');

// Now scoped providers are accessible
const session = httpScope.get(UserSession);
const logger = httpScope.get(RequestLogger);

// Global providers are still accessible
const database = httpScope.get(Database); // Works if Database is global
```

## Scope Isolation

Each scoped container maintains its own instances:

```typescript
// Request 1
const scope1 = injector.createChildScope('http');
const session1 = scope1.get(UserSession);
const logger1 = scope1.get(RequestLogger);

// Request 2
const scope2 = injector.createChildScope('http');
const session2 = scope2.get(UserSession);
const logger2 = scope2.get(RequestLogger);

// Different instances per scope
console.log(session1 === session2); // false
console.log(logger1 === logger2);   // false

// But same instance within a scope
const session1Again = scope1.get(UserSession);
console.log(session1 === session1Again); // true
```

## Dynamic Value Setting

Scoped containers can have values set dynamically from the outside. This is particularly useful for injecting request-specific data:

```typescript
class HttpRequest {
    constructor(public url: string, public method: string) {}
}

class HttpResponse {
    constructor(public statusCode: number = 200) {}
}

const injector = InjectorContext.forProviders([
    { provide: HttpRequest, scope: 'http' },
    { provide: HttpResponse, scope: 'http' },
    { provide: UserSession, scope: 'http' }
]);

// Simulate HTTP server
httpServer.on('request', (req, res) => {
    const httpScope = injector.createChildScope('http');

    // Set request-specific values
    httpScope.set(HttpRequest, new HttpRequest(req.url, req.method));
    httpScope.set(HttpResponse, new HttpResponse());

    // Now any service can access these
    const controller = httpScope.get(ApiController);
    controller.handleRequest();
});
```

## Real-World Example: HTTP Request Handling

```typescript
class UserSession {
    constructor(
        private request: HttpRequest,
        private userRepository: UserRepository
    ) {}

    async getCurrentUser() {
        const token = this.request.headers.authorization;
        return this.userRepository.findByToken(token);
    }
}

class ApiController {
    constructor(
        private session: UserSession,
        private logger: RequestLogger
    ) {}

    async getProfile() {
        this.logger.log('Getting user profile');
        const user = await this.session.getCurrentUser();
        return { user };
    }
}

// Setup
const injector = InjectorContext.forProviders([
    UserRepository,                                    // Global
    { provide: HttpRequest, scope: 'http' },          // Request-scoped
    { provide: UserSession, scope: 'http' },          // Request-scoped
    { provide: RequestLogger, scope: 'http' },        // Request-scoped
    { provide: ApiController, scope: 'http' }         // Request-scoped
]);

// Per request
app.get('/profile', (req, res) => {
    const scope = injector.createChildScope('http');
    scope.set(HttpRequest, req);

    const controller = scope.get(ApiController);
    return controller.getProfile();
});
```

## Built-in Scopes in Deepkit Framework

Applications using the Deepkit framework have these scopes by default:

- **`http`**: HTTP request lifecycle - see [HTTP](../http.md)
- **`rpc`**: RPC call lifecycle - see [RPC](../rpc.md)
- **`cli`**: CLI command lifecycle - see [CLI](../cli.md)

## Performance Considerations

- **Scope Creation**: Creating scopes is lightweight but not free
- **Memory**: Scoped instances are garbage collected when the scope is released
- **Dependency Resolution**: Scoped resolution is slightly slower than global
- **Best Practice**: Use scopes judiciously - not every service needs to be scoped

## Common Patterns

### Request Context Pattern
```typescript
class RequestContext {
    constructor(
        public request: HttpRequest,
        public user: User,
        public traceId: string
    ) {}
}

// Set once per request, used by many services
scope.set(RequestContext, new RequestContext(req, user, traceId));
```

### Transactional Services
```typescript
class TransactionalUserService {
    constructor(
        private transaction: DatabaseTransaction,
        private userRepository: UserRepository
    ) {}
}

// Each request gets its own transaction
scope.set(DatabaseTransaction, db.beginTransaction());
```
