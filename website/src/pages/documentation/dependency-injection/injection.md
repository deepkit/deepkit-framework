# Injection

Dependency Injection is the process of providing dependencies to a class or function automatically. Deepkit's injector analyzes TypeScript types at compile time to determine what dependencies are needed and resolves them automatically.

## Constructor Injection

Constructor injection is the most common and recommended pattern. Dependencies are declared as constructor parameters and automatically injected when the class is instantiated.

```typescript
class Database {
    connect() { /* ... */ }
}

class Logger {
    log(message: string) { /* ... */ }
}

class UserService {
    constructor(
        private database: Database,
        private logger: Logger
    ) {}

    async getUser(id: string) {
        this.logger.log(`Fetching user ${id}`);
        // Use this.database to fetch user
    }
}

// All dependencies are automatically resolved
const injector = Injector.from([Database, Logger, UserService]);
const userService = injector.get(UserService);
```

**Optional Dependencies**: Mark dependencies as optional to avoid errors when providers are not available:

```typescript
class MyService {
    constructor(
        private database: Database,
        private cache?: CacheService  // Optional - won't throw if not provided
    ) {}

    getData(key: string) {
        if (this.cache) {
            return this.cache.get(key) || this.database.get(key);
        }
        return this.database.get(key);
    }
}
```

## Property Injection

Property injection provides an alternative to constructor injection. It's useful when you have optional dependencies, want to avoid constructor parameter bloat, or need to inject dependencies after construction. Properties are automatically assigned after the instance is created.

```typescript
import { Inject } from '@deepkit/core';

class MyService {
    // Required property injection
    protected database!: Inject<Database>;

    // Optional property injection
    protected cache?: Inject<CacheService>;

    // You can also inject with tokens
    protected apiKey!: Inject<string, 'api.key'>;

    constructor(private logger: Logger) {
        // Constructor injection can be mixed with property injection
    }

    async getData(id: string) {
        // Properties are available after construction
        this.logger.log(`Fetching data for ${id}`);

        if (this.cache) {
            const cached = await this.cache.get(id);
            if (cached) return cached;
        }

        const data = await this.database.get(id);
        this.cache?.set(id, data);
        return data;
    }
}

// Setup providers including token-based injection
const injector = Injector.from([
    Database,
    Logger,
    CacheService,
    MyService,
    { provide: 'api.key', useValue: 'secret-key-123' }
]);
```

**When to use Property Injection:**
- Optional dependencies that may not always be available
- Breaking circular dependencies (though this should be rare)
- Reducing constructor parameter count
- Late binding scenarios

## Parameter Injection

Parameter injection allows you to inject dependencies directly into function parameters. This is particularly useful for HTTP routes, CLI commands, event handlers, and other callback functions where you don't control the instantiation.

```typescript
import { Database } from './db';
import { Logger } from './logger';

// HTTP route with injected dependencies
app.get('/users/:id', (
    id: string,                    // Route parameter
    database: Database,            // Injected dependency
    logger: Logger,               // Another injected dependency
    request: HttpRequest          // Framework-provided dependency
) => {
    logger.log(`Fetching user ${id}`);
    return database.findUser(id);
});

// CLI command with injection
app.command('migrate', (
    database: Database,
    logger: Logger,
    config: AppConfig['database']  // Configuration injection
) => {
    logger.log('Starting migration...');
    database.migrate();
});

// Event handler with injection
eventBus.on('user.created', (
    event: UserCreatedEvent,       // Event data
    emailService: EmailService,    // Injected service
    logger: Logger                 // Injected logger
) => {
    logger.log(`Sending welcome email to ${event.user.email}`);
    emailService.sendWelcomeEmail(event.user);
});
```

**Mixed Parameters**: You can mix regular parameters with injected dependencies. The injector automatically distinguishes between them based on type information.

## Dynamic Resolution with InjectorContext

Sometimes you need to resolve dependencies dynamically at runtime rather than through static injection. The `InjectorContext` provides programmatic access to the dependency injection container.

```typescript
import { InjectorContext } from '@deepkit/injector';

class ServiceFactory {
    constructor(private context: InjectorContext) {}

    createService(type: 'user' | 'product'): any {
        switch (type) {
            case 'user':
                return this.context.get(UserService);
            case 'product':
                return this.context.get(ProductService);
            default:
                throw new Error(`Unknown service type: ${type}`);
        }
    }
}

class PluginManager {
    constructor(private context: InjectorContext) {}

    loadPlugin(pluginClass: ClassType) {
        // Dynamically resolve plugin with its dependencies
        return this.context.get(pluginClass);
    }
}
```

**Scoped Resolution**: This is especially useful when working with [Dependency Injection Scopes](./scopes.md):

```typescript
class RequestHandler {
    constructor(private context: InjectorContext) {}

    async handleRequest(request: HttpRequest) {
        // Create a request scope
        const requestScope = this.context.createChildScope('http');

        // Set request-specific values
        requestScope.set(HttpRequest, request);

        // Get request-scoped services
        const userSession = requestScope.get(UserSession);
        const controller = requestScope.get(ApiController);

        return controller.handle();
    }
}
```

## Circular Dependency Detection

Deepkit automatically detects circular dependencies and provides helpful error messages:

```typescript
class ServiceA {
    constructor(private serviceB: ServiceB) {}
}

class ServiceB {
    constructor(private serviceA: ServiceA) {}
}

// This will throw a CircularDependencyError
const injector = Injector.from([ServiceA, ServiceB]);
// Error: Circular dependency found ServiceA -> ServiceB -> ServiceA
```

**Resolving Circular Dependencies:**
1. **Redesign**: Often indicates a design issue - consider extracting shared logic
2. **Property Injection**: Use property injection for one of the dependencies
3. **Factory Pattern**: Use a factory to break the cycle
4. **Event-Driven**: Use events instead of direct dependencies

## Advanced Injection Patterns

### Partial Factory

Create instances with some dependencies injected and others provided manually:

```typescript
import { PartialFactory } from '@deepkit/injector';

class ReportGenerator {
    constructor(
        private database: Database,    // Injected
        private template: string,      // Manual
        private options: ReportOptions // Manual
    ) {}
}

class ReportService {
    constructor(private factory: PartialFactory<ReportGenerator>) {}

    generateReport(template: string, options: ReportOptions) {
        // Database is injected, template and options are provided manually
        const generator = this.factory({ template, options });
        return generator.generate();
    }
}
```

### Transient Injection Target

Access information about what is requesting the injection:

```typescript
import { TransientInjectionTarget } from '@deepkit/injector';

class Logger {
    constructor(private target: TransientInjectionTarget) {}

    log(message: string) {
        const className = this.target.token.name || 'Unknown';
        console.log(`[${className}] ${message}`);
    }
}

class UserService {
    constructor(private logger: Logger) {}

    getUser() {
        this.logger.log('Getting user'); // Logs: [UserService] Getting user
    }
}
```
