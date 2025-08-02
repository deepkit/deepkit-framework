# Dependency Injection in HTTP

Dependency Injection (DI) is a fundamental design pattern that Deepkit HTTP leverages to create clean, testable, and maintainable applications. Instead of creating dependencies manually, you declare what you need and let the DI container provide it.

## Why Dependency Injection Matters

### Traditional Approach (Without DI)
```typescript
class UserController {
    @http.GET('/users/:id')
    async getUser(id: number) {
        // Tightly coupled - hard to test and maintain
        const database = new Database('connection-string');
        const logger = new Logger('user-service');
        const cache = new RedisCache('redis://localhost');

        logger.info(`Fetching user ${id}`);
        const user = await database.query(User).filter({id}).findOne();
        await cache.set(`user:${id}`, user);

        return user;
    }
}
```

### Dependency Injection Approach
```typescript
class UserController {
    constructor(
        private database: Database,
        private logger: Logger,
        private cache: CacheService
    ) {}

    @http.GET('/users/:id')
    async getUser(id: number) {
        // Clean, testable, and flexible
        this.logger.info(`Fetching user ${id}`);
        const user = await this.database.query(User).filter({id}).findOne();
        await this.cache.set(`user:${id}`, user);

        return user;
    }
}
```

### Benefits of DI in HTTP Applications

- **Testability**: Easy to mock dependencies for unit testing
- **Flexibility**: Swap implementations without changing code
- **Separation of Concerns**: Controllers focus on HTTP logic, not object creation
- **Configuration**: Centralized dependency configuration
- **Lifecycle Management**: Automatic cleanup and resource management

## How DI Works in Deepkit HTTP

Deepkit HTTP integrates seamlessly with the DI container, allowing you to inject dependencies into:

- **Controller constructors**: Shared dependencies across all methods
- **Route methods**: Method-specific dependencies
- **Functional routes**: Direct parameter injection
- **Event listeners**: Dependencies in workflow event handlers

### Basic Dependency Injection

First, register your services as providers:

```typescript
class Database {
    constructor(private connectionString: string) {}

    async query(entity: any) {
        // Database implementation
        return { filter: () => ({ findOne: () => Promise.resolve({}) }) };
    }
}

class Logger {
    info(message: string) {
        console.log(`[INFO] ${message}`);
    }
}

const app = new App({
    providers: [
        Database,
        Logger,
        // Or with configuration
        { provide: Database, useFactory: () => new Database('postgresql://...') }
    ],
    controllers: [UserController]
});
```

### Injection in Controllers

#### Constructor Injection (Recommended)
```typescript
class UserController {
    constructor(
        private database: Database,
        private logger: Logger
    ) {}

    @http.GET('/users/:id')
    async getUser(id: number) {
        this.logger.info(`Fetching user ${id}`);
        return await this.database.query(User).filter({id}).findOne();
    }

    @http.POST('/users')
    async createUser(userData: CreateUserRequest) {
        this.logger.info('Creating new user');
        return await this.database.save(userData);
    }
}
```

#### Method-Level Injection
```typescript
class UserController {
    @http.GET('/users/:id')
    async getUser(id: number, database: Database, logger: Logger) {
        logger.info(`Fetching user ${id}`);
        return await database.query(User).filter({id}).findOne();
    }
}
```

### Injection in Functional Routes

```typescript
// Direct parameter injection
router.get('/users/:id', async (id: number, database: Database, logger: Logger) => {
    logger.info(`Fetching user ${id}`);
    return await database.query(User).filter({id}).findOne();
});

// Mixed with HTTP parameters
router.post('/users', async (
    userData: HttpBody<CreateUserRequest>,
    database: Database,
    logger: Logger
) => {
    logger.info('Creating new user');
    return await database.save(userData);
});
```

See [Dependency Injection](../app/dependency-injection) for comprehensive DI documentation.

## HTTP Scope and Request Lifecycle

Understanding DI scopes is crucial for building efficient and secure HTTP applications. Deepkit HTTP uses a special `http` scope that creates a new DI container for each request, providing isolation and automatic cleanup.

### How HTTP Scope Works

```
Request 1 → HTTP DI Container 1 → Response 1 → Container Destroyed
Request 2 → HTTP DI Container 2 → Response 2 → Container Destroyed
Request 3 → HTTP DI Container 3 → Response 3 → Container Destroyed
```

Each HTTP request gets its own isolated DI container that:
- **Inherits** singleton providers from the application scope
- **Creates** new instances of HTTP-scoped providers
- **Provides** request-specific objects like `HttpRequest` and `HttpResponse`
- **Cleans up** automatically when the request completes

### Built-in HTTP Dependencies

Deepkit automatically provides several objects in the HTTP scope:

```typescript
import { HttpRequest, HttpResponse } from '@deepkit/http';

// Access request information
router.get('/info', (request: HttpRequest) => {
    return {
        method: request.method,
        url: request.url,
        headers: request.headers,
        ip: request.ip
    };
});

// Direct response manipulation
router.get('/custom', (response: HttpResponse) => {
    response.setHeader('X-Custom-Header', 'value');
    response.statusCode = 201;
    response.end('Custom response');
});

// Combined with other dependencies
router.get('/users/:id', (
    id: number,
    request: HttpRequest,
    database: Database,
    logger: Logger
) => {
    logger.info(`User ${id} requested from ${request.ip}`);
    return database.findUser(id);
});
```

### Creating HTTP-Scoped Services

HTTP-scoped services are created fresh for each request, making them perfect for:
- **Request-specific state**: User sessions, request context
- **Per-request caching**: Avoid duplicate database calls within a request
- **Request tracking**: Logging, metrics, tracing
- **Security context**: Authentication state, permissions

```typescript
class RequestContext {
    private startTime = Date.now();
    private requestId = Math.random().toString(36);

    getRequestId(): string {
        return this.requestId;
    }

    getDuration(): number {
        return Date.now() - this.startTime;
    }
}

class UserSession {
    private user?: User;

    setUser(user: User): void {
        this.user = user;
    }

    getUser(): User {
        if (!this.user) {
            throw new HttpUnauthorizedError('Not authenticated');
        }
        return this.user;
    }

    isAuthenticated(): boolean {
        return !!this.user;
    }
}

const app = new App({
    providers: [
        // Singleton services (shared across requests)
        Database,
        Logger,

        // HTTP-scoped services (new instance per request)
        { provide: RequestContext, scope: 'http' },
        { provide: UserSession, scope: 'http' }
    ]
});
```

### Using HTTP-Scoped Services

```typescript
class UserController {
    @http.GET('/profile')
    getProfile(session: UserSession, context: RequestContext) {
        const user = session.getUser(); // Throws if not authenticated

        return {
            user: { id: user.id, username: user.username },
            requestId: context.getRequestId(),
            processingTime: context.getDuration()
        };
    }

    @http.POST('/login')
    login(
        credentials: LoginRequest,
        session: UserSession,
        authService: AuthService
    ) {
        const user = authService.authenticate(credentials);
        session.setUser(user); // Set for this request

        return { success: true, user: { id: user.id, username: user.username } };
    }
}
```

### Memory Management and Performance

HTTP scope provides automatic memory management:

```typescript
class ExpensiveService {
    private cache = new Map();

    constructor(private database: Database) {
        console.log('ExpensiveService created for request');
    }

    async getData(key: string) {
        if (this.cache.has(key)) {
            return this.cache.get(key);
        }

        const data = await this.database.query(key);
        this.cache.set(key, data); // Cache only for this request
        return data;
    }
}

// Register as HTTP-scoped
const app = new App({
    providers: [
        { provide: ExpensiveService, scope: 'http' }
    ]
});
```

**Benefits:**
- **Isolation**: Each request gets its own cache
- **Automatic cleanup**: Cache is destroyed when request completes
- **No memory leaks**: No need to manually clear caches
- **Performance**: Avoid duplicate work within a single request

See [Dependency Injection Scopes](../app/dependency-injection#di-scopes) for detailed scope documentation.

## HTTP-Specific Providers

### Request-Scoped Services

HTTP-scoped providers are created for each request and automatically cleaned up when the request completes:

```typescript
class UserSession {
    private user?: User;

    setUser(user: User): void {
        this.user = user;
    }

    getUser(): User | undefined {
        return this.user;
    }
}

class RequestLogger {
    private logs: string[] = [];

    log(message: string): void {
        this.logs.push(`[${new Date().toISOString()}] ${message}`);
    }

    getLogs(): string[] {
        return this.logs;
    }
}

const app = new App({
    providers: [
        { provide: UserSession, scope: 'http' },
        { provide: RequestLogger, scope: 'http' }
    ],
    controllers: [UserController]
});
```

### Factory Providers with Request Data

Create providers that depend on request information:

```typescript
class User {
    constructor(public id: number, public username: string) {}
}

const app = new App({
    providers: [
        {
            provide: User,
            scope: 'http',
            useFactory: (request: HttpRequest) => {
                // Extract user from request (e.g., from JWT token)
                const authHeader = request.headers.authorization;
                if (authHeader) {
                    const token = authHeader.replace('Bearer ', '');
                    const userData = decodeJWT(token);
                    return new User(userData.id, userData.username);
                }
                throw new HttpUnauthorizedError('No authentication provided');
            }
        }
    ]
});
```

### Conditional Providers

Provide different implementations based on request context:

```typescript
interface DatabaseService {
    query(sql: string): Promise<any>;
}

class ProductionDatabase implements DatabaseService {
    async query(sql: string): Promise<any> {
        // Real database implementation
        return [];
    }
}

class TestDatabase implements DatabaseService {
    async query(sql: string): Promise<any> {
        // Mock implementation for testing
        return [{ id: 1, name: 'Test Data' }];
    }
}

const app = new App({
    providers: [
        {
            provide: DatabaseService,
            scope: 'http',
            useFactory: (request: HttpRequest) => {
                // Use test database for requests with test header
                if (request.headers['x-test-mode'] === 'true') {
                    return new TestDatabase();
                }
                return new ProductionDatabase();
            }
        }
    ]
});
```

## Advanced Injection Patterns

### Injecting Request Context

Access request information in any service:

```typescript
class AuditService {
    constructor(private request: HttpRequest) {}

    logAction(action: string, data?: any): void {
        console.log({
            timestamp: new Date().toISOString(),
            action,
            data,
            ip: this.request.ip,
            userAgent: this.request.headers['user-agent'],
            url: this.request.url
        });
    }
}

class UserController {
    @http.POST('/users')
    createUser(userData: any, auditService: AuditService) {
        // Create user logic
        auditService.logAction('user_created', { username: userData.username });
        return { success: true };
    }
}
```

### Multi-Provider Pattern

Provide multiple implementations and choose at runtime:

```typescript
interface NotificationService {
    send(message: string): Promise<void>;
}

class EmailNotificationService implements NotificationService {
    async send(message: string): Promise<void> {
        console.log('Sending email:', message);
    }
}

class SMSNotificationService implements NotificationService {
    async send(message: string): Promise<void> {
        console.log('Sending SMS:', message);
    }
}

class NotificationManager {
    constructor(
        private emailService: EmailNotificationService,
        private smsService: SMSNotificationService,
        private request: HttpRequest
    ) {}

    async notify(message: string): Promise<void> {
        // Choose notification method based on request
        const method = this.request.headers['x-notification-method'];

        if (method === 'sms') {
            await this.smsService.send(message);
        } else {
            await this.emailService.send(message);
        }
    }
}

const app = new App({
    providers: [
        EmailNotificationService,
        SMSNotificationService,
        { provide: NotificationManager, scope: 'http' }
    ]
});
```

### Injector Context Pattern

Use the injector context to set and retrieve typed services during the request lifecycle:

```typescript
class UserContext {
    constructor(
        public user: User,
        public permissions: string[] = []
    ) {}

    hasPermission(permission: string): boolean {
        return this.permissions.includes(permission);
    }
}

class RequestStore {
    // This will be set by the authentication system
    constructor() {
        throw new Error('RequestStore must be set via injector context during authentication');
    }
}

const app = new App({
    providers: [
        {
            provide: UserContext,
            scope: 'http',
            useFactory: () => {
                throw new Error('UserContext must be set via injector context during authentication');
            }
        },
        {
            provide: RequestStore,
            scope: 'http',
            useFactory: () => {
                throw new Error('RequestStore must be set via injector context during authentication');
            }
        }
    ]
});

// In an authentication event listener
app.listen(httpWorkflow.onAuth, (event) => {
    const user = authenticateUser(event.request);
    const permissions = getUserPermissions(user);

    // Set the user context via injector context
    const userContext = new UserContext(user, permissions);
    event.injectorContext.set(UserContext, userContext);

    // Set custom request store
    const requestStore = new RequestStore();
    // ... initialize request store with data
    event.injectorContext.set(RequestStore, requestStore);
});

// In a controller - now you can inject the typed services
class SecureController {
    @http.GET('/profile')
    getProfile(userContext: UserContext) {
        return {
            user: userContext.user,
            permissions: userContext.permissions,
            canEdit: userContext.hasPermission('edit_profile')
        };
    }

    @http.GET('/admin')
    adminPanel(userContext: UserContext, requestStore: RequestStore) {
        if (!userContext.hasPermission('admin_access')) {
            throw new HttpAccessDeniedError('Admin access required');
        }

        return { message: 'Welcome to admin panel' };
    }
}
```

## Testing with Dependency Injection

Mock services for testing:

```typescript
import { createTestingApp } from '@deepkit/framework';

class MockUserService {
    async getUser(id: number): Promise<User> {
        return new User(id, `Test User ${id}`);
    }
}

test('controller with mocked dependencies', async () => {
    const testing = createTestingApp({
        controllers: [UserController],
        providers: [
            { provide: UserService, useClass: MockUserService }
        ]
    });

    const response = await testing.request(HttpRequest.GET('/users/1'));
    expect(response.json.name).toBe('Test User 1');
});
```

## Best Practices

1. **Use HTTP scope for request-specific data**: Services that need request context
2. **Factory providers with error throwing**: Define providers that throw errors and set them via injector context
3. **Use injector context for runtime data**: Set providers during request lifecycle using `event.injectorContext.set()`
4. **Keep providers focused**: Each provider should have a single responsibility
5. **Initialize providers in events**: Use `onRequest` or `onAuth` events to set up request-scoped providers
6. **Mock dependencies in tests**: Use dependency injection for testability
7. **Avoid memory leaks**: HTTP-scoped providers are automatically cleaned up
8. **Type safety**: Use TypeScript interfaces for better type checking
9. **Document dependencies**: Make clear what each provider expects and provides
10. **Consistent error messages**: Use descriptive error messages in factory functions
