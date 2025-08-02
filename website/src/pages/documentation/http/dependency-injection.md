# Dependency Injection

The router functions as well as the controller classes and controller methods can define arbitrary dependencies, which are resolved by the dependency injection container. For example, it is possible to conveniently get to a database abstraction or logger.

For example, if a database has been provided as a provider, it can be injected:

```typescript
class Database {
    //...
}

const app = new App({
    providers: [
        Database,
    ],
});
```

_Functional API:_

```typescript
router.get('/user/:id', async (id: number, database: Database) => {
    return await database.query(User).filter({id}).findOne();
});
```

_Controller API:_

```typescript
class UserController {
    constructor(private database: Database) {}

    @http.GET('/user/:id')
    async userDetail(id: number) {
        return await this.database.query(User).filter({id}).findOne();
    }
}

//alternatively directly in the method
class UserController {
    @http.GET('/user/:id')
    async userDetail(id: number, database: Database) {
        return await database.query(User).filter({id}).findOne();
    }
}
```

See [Dependency Injection](dependency-injection) to learn more.

## Scope

All HTTP controllers and functional routes are managed within the `http` dependency injection scope. HTTP controllers are instantiated accordingly for each HTTP request. This also means that both can access providers registered for the `http` scope. So additionally `HttpRequest` and `HttpResponse` from `@deepkit/http` are usable as dependencies. If deepkit framework is used, `SessionHandler` from `@deepkit/framework` is also available.

```typescript
import { HttpResponse } from '@deepkit/http';

router.get('/user/:id', (id: number, request: HttpRequest) => {
});

router.get('/', (response: HttpResponse) => {
    response.end('Hello');
});
```

It can be useful to place providers in the `http` scope, for example to instantiate services for each HTTP request. Once the HTTP request has been processed, the `http` scoped DI container is deleted, thus cleaning up all its provider instances from the garbage collector (GC).

See [Dependency Injection Scopes](dependency-injection.md#di-scopes) to learn how to place providers in the `http` scope.

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
