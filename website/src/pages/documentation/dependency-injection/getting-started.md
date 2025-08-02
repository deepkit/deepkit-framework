# Getting Started

Deepkit's dependency injection system is a high-performance, compile-time optimized container that provides automatic dependency resolution based on TypeScript types. Since Dependency Injection in Deepkit is based on Runtime Types, it is necessary to have Runtime Types already installed correctly. See [Runtime Type](../runtime-types/getting-started.md).

## Key Features

- **Type-safe**: Automatic dependency inferring based on TypeScript types
- **High Performance**: Compiling dependency injection with minimal runtime overhead
- **Flexible Providers**: Support for classes, factories, values, and existing providers
- **Scoped Injection**: Request, RPC, and custom scopes for lifecycle management
- **Configuration System**: Type-safe configuration injection with validation
- **Circular Dependency Detection**: Automatic detection and helpful error messages
- **Tagged Providers**: Group related services with tags

## Installation

If this is done successfully, `@deepkit/injector` can be installed or the Deepkit framework which already uses the library under the hood.

```sh
npm install @deepkit/injector
```

Once the library is installed, the API of it can be used directly.

## Usage

To use Dependency Injection now, there are three ways, each suited for different complexity levels:

* **Injector API** (Low Level) - Simple, single container
* **Module API** (Medium Level) - Multiple modules with imports/exports
* **App API** (Deepkit Framework) - Full framework integration

If `@deepkit/injector` is to be used without the Deepkit Framework, the first two variants are recommended.

### Injector API

The Injector API provides a simple, low-level interface for dependency injection. It is characterized by a very simple usage by means of a single class `Injector` that creates a single DI container and is particularly suitable for simpler applications without modules.

```typescript
import { Injector } from '@deepkit/injector';

class Database {
    connect() { /* ... */ }
}

class UserRepository {
    constructor(private db: Database) {}

    findUser(id: string) {
        // Use this.db to query users
    }
}

class UserService {
    constructor(private repository: UserRepository) {}

    getUser(id: string) {
        return this.repository.findUser(id);
    }
}

// Create injector with all dependencies
const injector = Injector.from([
    Database,
    UserRepository,
    UserService
]);

// Get fully constructed service with all dependencies injected
const userService = injector.get(UserService);
```

The `injector` object in this case is the dependency injection container. The function `Injector.from` takes an array of providers. Dependencies are automatically resolved based on constructor parameter types.

**When to use**: Simple applications, testing, or when you need a lightweight DI solution without module complexity.

### Module API

The `InjectorModule` API provides a more sophisticated approach for larger applications. It allows you to organize providers into separate modules, each with their own encapsulated scope, configuration, and import/export relationships. This creates a clean, hierarchical architecture that mirrors your application structure.

**Key Benefits:**
- **Encapsulation**: Each module has its own provider scope
- **Configuration**: Type-safe configuration per module
- **Imports/Exports**: Control which providers are shared between modules
- **Hierarchy**: Build complex application architectures

```typescript
import { InjectorModule, InjectorContext } from '@deepkit/injector';

// Database module - provides low-level database access
class DatabaseConfig {
    host: string = 'localhost';
    port: number = 5432;
}

class Database {
    constructor(private config: DatabaseConfig) {}
    connect() { /* ... */ }
}

const databaseModule = new InjectorModule([Database])
    .setConfigDefinition(DatabaseConfig)
    .addExport(Database); // Export Database to parent modules

// User module - provides user-related services
class UserRepository {
    constructor(private db: Database) {} // Imported from databaseModule
}

class UserService {
    constructor(private repository: UserRepository) {}
}

const userModule = new InjectorModule([UserRepository, UserService])
    .addImport(databaseModule)
    .addExport(UserService); // Only export UserService, keep UserRepository internal

// Root module - combines all modules
const rootModule = new InjectorModule([])
    .addImport(userModule);

// Configure the database
databaseModule.configure({ host: 'production-db.example.com', port: 5432 });

const injector = new InjectorContext(rootModule);
const userService = injector.get(UserService);
```

**Module Encapsulation**: All non-root modules are encapsulated by default. Providers in a module are only available within that module unless explicitly exported.

```typescript
// Get from root module (works - UserService is exported)
const userService = injector.get(UserService);

// Get from specific module (works - accessing internal provider)
const repository = injector.get(UserRepository, userModule);

// This would fail - UserRepository is not exported to root
// const repository = injector.get(UserRepository); // Error!
```

**Root Modules**: Use `forRoot()` to export all providers to the root level automatically:

```typescript
const sharedModule = new InjectorModule([HttpClient, Logger])
    .forRoot(); // All providers available globally
```

**When to use**: Medium to large applications that need modular architecture, configuration management, or when building reusable modules.

### App API (Deepkit Framework)

The App API is the highest-level interface, providing full framework integration with the Deepkit Framework. It builds upon the Module API but adds powerful features like hooks, configuration loaders, and automatic HTTP/RPC integration.

**Additional Features:**
- **Automatic HTTP/RPC Integration**: Controllers and routes with dependency injection
- **Lifecycle Hooks**: onBootstrap, onShutdown, etc.
- **Configuration Loaders**: Load config from files, environment variables
- **Built-in Modules**: HTTP, Database, Validation, etc.

```typescript
import { App } from '@deepkit/app';
import { FrameworkModule } from '@deepkit/framework';
import { HttpRouterRegistry, HttpBody } from '@deepkit/http';

interface User {
    id: number;
    username: string;
    email: string;
}

class UserRepository {
    private users: User[] = [];

    create(user: Omit<User, 'id'>): User {
        const newUser = { ...user, id: Date.now() };
        this.users.push(newUser);
        return newUser;
    }

    findAll(): User[] {
        return this.users;
    }
}

class UserService {
    constructor(private repository: UserRepository) {}

    async createUser(userData: Omit<User, 'id'>): Promise<User> {
        // Business logic here
        return this.repository.create(userData);
    }

    async getUsers(): Promise<User[]> {
        return this.repository.findAll();
    }
}

const app = new App({
    providers: [UserRepository, UserService],
    imports: [new FrameworkModule()],
});

// Dependency injection works automatically in HTTP routes
const router = app.get(HttpRouterRegistry);

router.post('/users', async (body: HttpBody<Omit<User, 'id'>>, service: UserService) => {
    return await service.createUser(body);
});

router.get('/users', async (service: UserService) => {
    return await service.getUsers();
});

app.run();
```

**When to use**: Full applications using the Deepkit Framework that need HTTP servers, databases, validation, and other framework features.

## Performance Considerations

Deepkit's injector is designed for high performance:

- **Compile-time optimization**: Dependency graphs are analyzed and optimized at build time
- **Minimal runtime overhead**: No reflection or metadata lookup during injection
- **Singleton by default**: Instances are cached to avoid repeated construction
- **Lazy instantiation**: Services are only created when first requested

## Next Steps

- Learn about different [Provider Types](./providers.md)
- Understand [Injection Patterns](./injection.md)
- Explore [Scopes](./scopes.md) for request-based lifecycles
- Set up [Configuration](./configuration.md) for your modules
