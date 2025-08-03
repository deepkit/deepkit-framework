# Middleware

Middleware provides a powerful way to intercept and modify HTTP requests and responses as they flow through your application. Think of middleware as a pipeline where each piece can inspect, modify, or even stop the request before it reaches your route handlers.

## Understanding Middleware

Middleware functions execute in sequence during the request/response cycle. Each middleware can:

- **Inspect requests**: Log, authenticate, validate headers
- **Modify requests**: Add data, transform headers, parse custom formats
- **Control flow**: Stop processing, redirect, or continue to the next middleware
- **Modify responses**: Add headers, transform data, handle errors
- **Perform side effects**: Logging, metrics, caching

### The Middleware Pipeline

```
Request → Middleware 1 → Middleware 2 → Route Handler → Response
            ↓              ↓                ↓
         Logging      Authentication    Business Logic
```

Each middleware calls `next()` to pass control to the next middleware in the chain. If `next()` is not called, the request stops at that middleware.

## Middleware Types

Deepkit HTTP supports two types of middleware:

### Class-Based Middleware (Recommended)

Class-based middleware integrates with Deepkit's dependency injection system, making it easy to inject services and maintain state:

```typescript
import { HttpMiddleware, httpMiddleware, HttpRequest, HttpResponse } from '@deepkit/http';

class LoggingMiddleware implements HttpMiddleware {
    constructor(private logger: Logger) {} // Dependency injection

    async execute(request: HttpRequest, response: HttpResponse, next: (err?: any) => void) {
        const startTime = Date.now();

        this.logger.info(`${request.method} ${request.url} - Started`);

        // Continue to next middleware/route
        next();

        // This runs after the response is sent
        const duration = Date.now() - startTime;
        this.logger.info(`${request.method} ${request.url} - ${response.statusCode} - ${duration}ms`);
    }
}
```

### Function-Based Middleware

Simple functions work well for basic middleware that doesn't need dependency injection:

```typescript
function corsMiddleware(request: HttpRequest, response: HttpResponse, next: (err?: any) => void) {
    response.setHeader('Access-Control-Allow-Origin', '*');
    response.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
    response.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (request.method === 'OPTIONS') {
        response.statusCode = 200;
        response.end();
        return; // Don't call next() - request is complete
    }

    next(); // Continue to next middleware
}
```

### Registering Middleware

```typescript
import { App } from '@deepkit/app';
import { FrameworkModule } from '@deepkit/framework';

new App({
    providers: [LoggingMiddleware, Logger], // Register class-based middleware as provider
    middlewares: [
        httpMiddleware.for(LoggingMiddleware),     // Class-based
        httpMiddleware.for(corsMiddleware),       // Function-based
    ],
    imports: [new FrameworkModule]
}).run();
```

## How Middleware Execution Works

Understanding the execution flow is crucial for writing effective middleware:

```typescript
class TimingMiddleware implements HttpMiddleware {
    async execute(request: HttpRequest, response: HttpResponse, next: (err?: any) => void) {
        console.log('1. Before next()');

        next(); // Control passes to next middleware/route

        console.log('4. After next() - response is ready');
    }
}

class AuthMiddleware implements HttpMiddleware {
    async execute(request: HttpRequest, response: HttpResponse, next: (err?: any) => void) {
        console.log('2. Auth middleware executing');

        // Simulate authentication
        if (!request.headers.authorization) {
            response.statusCode = 401;
            response.end('Unauthorized');
            return; // Don't call next() - stop here
        }

        next(); // Continue to route handler

        console.log('3. Auth middleware cleanup');
    }
}

// Route handler
router.get('/protected', () => {
    console.log('Route handler executing');
    return { message: 'Protected data' };
});
```

**Execution order**: TimingMiddleware → AuthMiddleware → Route Handler → AuthMiddleware cleanup → TimingMiddleware cleanup

## Middleware Scope and Targeting

Deepkit HTTP provides flexible ways to control where middleware executes. You can apply middleware globally, to specific controllers, routes, or based on various criteria.

### Global Middleware

Global middleware executes for every HTTP request in your application. This is perfect for cross-cutting concerns like logging, CORS, security headers, or authentication.

```typescript
import { httpMiddleware } from '@deepkit/http';

class SecurityHeadersMiddleware implements HttpMiddleware {
    async execute(request: HttpRequest, response: HttpResponse, next: (err?: any) => void) {
        // Add security headers to all responses
        response.setHeader('X-Frame-Options', 'DENY');
        response.setHeader('X-Content-Type-Options', 'nosniff');
        response.setHeader('X-XSS-Protection', '1; mode=block');

        next();
    }
}

new App({
    providers: [SecurityHeadersMiddleware],
    middlewares: [
        httpMiddleware.for(SecurityHeadersMiddleware) // Applies to ALL routes
    ],
    imports: [new FrameworkModule]
}).run();
```

**When to use global middleware:**
- Security headers that should be on every response
- Request logging and monitoring
- CORS handling
- Rate limiting
- Authentication checks (though you might want more targeted approaches)

### Controller-Specific Middleware

Apply middleware to specific controllers when you need functionality that's relevant to a particular area of your application.

#### Using Controller Decorators

```typescript
class AdminAuthMiddleware implements HttpMiddleware {
    async execute(request: HttpRequest, response: HttpResponse, next: (err?: any) => void) {
        // Check for admin privileges
        const user = await this.authenticateUser(request);
        if (!user || !user.isAdmin) {
            response.statusCode = 403;
            response.end('Admin access required');
            return;
        }

        next();
    }
}

@http.middleware(AdminAuthMiddleware)
class AdminController {
    @http.GET('/admin/users')
    listUsers() {
        return { users: [] };
    }

    @http.DELETE('/admin/users/:id')
    deleteUser(id: number) {
        return { deleted: id };
    }
}
```

#### Using Middleware Configuration

```typescript
class ApiKeyMiddleware implements HttpMiddleware {
    async execute(request: HttpRequest, response: HttpResponse, next: (err?: any) => void) {
        const apiKey = request.headers['x-api-key'];
        if (!apiKey || !this.isValidApiKey(apiKey)) {
            response.statusCode = 401;
            response.end('Valid API key required');
            return;
        }
        next();
    }
}

new App({
    providers: [ApiKeyMiddleware],
    controllers: [PublicController, ApiController, AdminController],
    middlewares: [
        // Apply API key middleware only to API controllers
        httpMiddleware.for(ApiKeyMiddleware).forControllers(ApiController, AdminController),

        // Exclude specific controllers if needed
        httpMiddleware.for(SomeMiddleware).excludeControllers(PublicController)
    ],
    imports: [new FrameworkModule]
}).run();
```

**When to use controller-specific middleware:**
- Authentication/authorization for specific areas (admin, API, user areas)
- Different rate limiting for different controller types
- Specialized logging or monitoring for certain features
- Content negotiation for API vs web controllers

## Per Route Name

`forRouteNames` along with its counterpart `excludeRouteNames` allow you to filter the execution of a middleware per route names.

```typescript
class MyFirstController {
    @http.GET('/hello').name('firstRoute')
    myAction() {
    }

    @http.GET('/second').name('secondRoute')
    myAction2() {
    }
}
new App({
    controllers: [MainController, UsersCommand],
    providers: [MyMiddleware],
    middlewares: [
        httpMiddleware.for(MyMiddleware).forRouteNames('firstRoute', 'secondRoute')
    ],
    imports: [new FrameworkModule]
}).run();
```


## Per Action/Route

To execute a middleware only for a certain route, you can either use `@http.GET().middleware()` or
`httpMiddleware.for(T).forRoute()` where forRoute has multiple options to filter routes.

```typescript
class MyFirstController {
    @http.GET('/hello').middleware(MyMiddleware)
    myAction() {
    }
}
new App({
    controllers: [MainController, UsersCommand],
    providers: [MyMiddleware],
    middlewares: [
        httpMiddleware.for(MyMiddleware).forRoutes({
            path: 'api/*'
        })
    ],
    imports: [new FrameworkModule]
}).run();
```

`forRoutes()` allows as first argument several way to filter for routes.

```typescript
{
    path?: string;
    pathRegExp?: RegExp;
    httpMethod?: 'GET' | 'HEAD' | 'POST' | 'PATCH' | 'PUT' | 'DELETE' | 'OPTIONS' | 'TRACE';
    category?: string;
    excludeCategory?: string;
    group?: string;
    excludeGroup?: string;
}
```

## Path Pattern

`path` supports wildcard *.

```typescript
httpMiddleware.for(MyMiddleware).forRoutes({
    path: 'api/*'
})
```

## RegExp

```typescript
httpMiddleware.for(MyMiddleware).forRoutes({
    pathRegExp: /'api/.*'/
})
```

## HTTP Method

Filter all routes by a HTTP method.

```typescript
httpMiddleware.for(MyMiddleware).forRoutes({
    httpMethod: 'GET'
})
```

## Category

`category` along with its counterpart `excludeCategory` allow you to filter per route category.

```typescript
@http.category('myCategory')
class MyFirstController {

}

class MySecondController {
    @http.GET().category('myCategory')
    myAction() {
    }
}
httpMiddleware.for(MyMiddleware).forRoutes({
    category: 'myCategory'
})
```

## Group

`group` along with its counterpart `excludeGroup` allow you to filter per route group.

```typescript
@http.group('myGroup')
class MyFirstController {

}

class MySecondController {
    @http.GET().group('myGroup')
    myAction() {
    }
}
httpMiddleware.for(MyMiddleware).forRoutes({
    group: 'myGroup'
})
```

## Per Modules

You can limit the execution of a module for a whole module.

```typescript
httpMiddleware.for(MyMiddleware).forModule(ApiModule)
```


## Per Self Modules

To execute a middleware for all controllers/routes of a module where the middleware was registered use `forSelfModules()`.

```typescript
const ApiModule = new AppModule({}, {
    controllers: [MainController, UsersCommand],
    providers: [MyMiddleware],
    middlewares: [
        //for all controllers registered of the same module
        httpMiddleware.for(MyMiddleware).forSelfModules(),
    ],
});
```

## Timeout

All middleware needs to execute `next()` sooner or later. If a middleware does not execute `next()` withing a timeout, a warning is logged and the next middleware executed. To change the default of 4seconds to something else use timeout(milliseconds).

```typescript
const ApiModule = new AppModule({}, {
    controllers: [MainController, UsersCommand],
    providers: [MyMiddleware],
    middlewares: [
        //for all controllers registered of the same module
        httpMiddleware.for(MyMiddleware).timeout(15_000),
    ],
});
```

## Multiple Rules

To combine multiple filters, you can chain method calls.

```typescript
const ApiModule = new AppModule({}, {
    controllers: [MyController],
    providers: [MyMiddleware],
    middlewares: [
        httpMiddleware.for(MyMiddleware).forControllers(MyController).excludeRouteNames('secondRoute')
    ],
});
```

## Express Middleware

Almost all express middlewares are supported. Those who access certain request methods of express are not yet supported.

```typescript
import * as compression from 'compression';

const ApiModule = new AppModule({}, {
    middlewares: [
        httpMiddleware.for(compress()).forControllers(MyController)
    ],
});
```

## Advanced Middleware Patterns

### Async Middleware

Middleware can be asynchronous and perform complex operations:

```typescript
class DatabaseMiddleware implements HttpMiddleware {
    constructor(private database: Database) {}

    async execute(request: HttpRequest, response: HttpResponse, next: (err?: any) => void) {
        try {
            // Perform async database operation
            const user = await this.database.getUserFromSession(request);
            request.store.user = user;
            next();
        } catch (error) {
            next(error);
        }
    }
}
```

### Error Handling Middleware

```typescript
class ErrorHandlingMiddleware implements HttpMiddleware {
    async execute(request: HttpRequest, response: HttpResponse, next: (err?: any) => void) {
        try {
            next();
        } catch (error) {
            console.error('Request error:', error);

            if (!response.headersSent) {
                response.statusCode = 500;
                response.setHeader('Content-Type', 'application/json');
                response.end(JSON.stringify({
                    error: 'Internal Server Error',
                    message: process.env.NODE_ENV === 'development' ? error.message : undefined
                }));
            }
        }
    }
}
```

### Request Logging Middleware

```typescript
class RequestLoggingMiddleware implements HttpMiddleware {
    async execute(request: HttpRequest, response: HttpResponse, next: (err?: any) => void) {
        const startTime = Date.now();

        console.log(`${request.method} ${request.url} - Started`);

        // Override response.end to log completion
        const originalEnd = response.end.bind(response);
        response.end = function(chunk?: any) {
            const duration = Date.now() - startTime;
            console.log(`${request.method} ${request.url} - ${response.statusCode} - ${duration}ms`);
            return originalEnd(chunk);
        };

        next();
    }
}
```

### Authentication Middleware

```typescript
class AuthenticationMiddleware implements HttpMiddleware {
    async execute(request: HttpRequest, response: HttpResponse, next: (err?: any) => void) {
        const authHeader = request.headers.authorization;

        if (!authHeader) {
            response.statusCode = 401;
            response.setHeader('Content-Type', 'application/json');
            response.end(JSON.stringify({ error: 'Authentication required' }));
            return;
        }

        try {
            const token = authHeader.replace('Bearer ', '');
            const user = await this.validateToken(token);
            request.store.user = user;
            next();
        } catch (error) {
            response.statusCode = 401;
            response.setHeader('Content-Type', 'application/json');
            response.end(JSON.stringify({ error: 'Invalid token' }));
        }
    }

    private async validateToken(token: string): Promise<User> {
        // Implement token validation logic
        throw new Error('Not implemented');
    }
}
```

### Rate Limiting Middleware

```typescript
class RateLimitingMiddleware implements HttpMiddleware {
    private requests = new Map<string, { count: number; resetTime: number }>();
    private maxRequests = 100;
    private windowMs = 15 * 60 * 1000; // 15 minutes

    async execute(request: HttpRequest, response: HttpResponse, next: (err?: any) => void) {
        const clientIp = request.ip || request.headers['x-forwarded-for'] as string;
        const now = Date.now();

        const userRequests = this.requests.get(clientIp);

        if (!userRequests || now > userRequests.resetTime) {
            this.requests.set(clientIp, { count: 1, resetTime: now + this.windowMs });
            next();
            return;
        }

        if (userRequests.count >= this.maxRequests) {
            response.statusCode = 429;
            response.setHeader('Content-Type', 'application/json');
            response.setHeader('Retry-After', Math.ceil((userRequests.resetTime - now) / 1000).toString());
            response.end(JSON.stringify({ error: 'Too many requests' }));
            return;
        }

        userRequests.count++;
        next();
    }
}
```

### CORS Middleware

```typescript
class CorsMiddleware implements HttpMiddleware {
    private allowedOrigins = ['http://localhost:3000', 'https://myapp.com'];

    async execute(request: HttpRequest, response: HttpResponse, next: (err?: any) => void) {
        const origin = request.headers.origin;

        if (origin && this.allowedOrigins.includes(origin)) {
            response.setHeader('Access-Control-Allow-Origin', origin);
        }

        response.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
        response.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
        response.setHeader('Access-Control-Allow-Credentials', 'true');

        if (request.method === 'OPTIONS') {
            response.statusCode = 200;
            response.end();
            return;
        }

        next();
    }
}
```

## Middleware Ordering

The order of middleware execution is important. Middleware is executed in the order it's registered:

```typescript
new App({
    middlewares: [
        httpMiddleware.for(CorsMiddleware),           // 1. Handle CORS first
        httpMiddleware.for(RequestLoggingMiddleware), // 2. Log requests
        httpMiddleware.for(RateLimitingMiddleware),   // 3. Rate limiting
        httpMiddleware.for(AuthenticationMiddleware), // 4. Authentication
        httpMiddleware.for(ErrorHandlingMiddleware),  // 5. Error handling last
    ],
    imports: [new FrameworkModule]
});
```

## Conditional Middleware

Apply middleware only to specific routes or conditions:

```typescript
class ConditionalMiddleware implements HttpMiddleware {
    async execute(request: HttpRequest, response: HttpResponse, next: (err?: any) => void) {
        // Only apply to API routes
        if (request.url.startsWith('/api/')) {
            // Apply middleware logic
            console.log('API request:', request.url);
        }

        next();
    }
}

// Or use route-specific middleware
new App({
    middlewares: [
        httpMiddleware.for(AuthenticationMiddleware).forRoutes({ path: '/admin/*' }),
        httpMiddleware.for(RateLimitingMiddleware).forRoutes({ group: 'api' }),
    ],
});
```

## Testing Middleware

```typescript
import { expect, test } from '@jest/globals';
import { createTestingApp } from '@deepkit/framework';

test('middleware execution', async () => {
    const logs: string[] = [];

    class TestMiddleware implements HttpMiddleware {
        async execute(request: HttpRequest, response: HttpResponse, next: (err?: any) => void) {
            logs.push(`Before: ${request.method} ${request.url}`);
            next();
            logs.push(`After: ${request.method} ${request.url}`);
        }
    }

    class TestController {
        @http.GET('/test')
        test() {
            logs.push('Controller executed');
            return 'success';
        }
    }

    const testing = createTestingApp({
        controllers: [TestController],
        providers: [TestMiddleware],
        middlewares: [httpMiddleware.for(TestMiddleware)]
    });

    await testing.request(HttpRequest.GET('/test'));

    expect(logs).toEqual([
        'Before: GET /test',
        'Controller executed',
        'After: GET /test'
    ]);
});
```

## Best Practices

1. **Keep middleware focused**: Each middleware should have a single responsibility
2. **Handle errors properly**: Always use try-catch in async middleware
3. **Call next()**: Always call next() to continue the middleware chain
4. **Order matters**: Place middleware in logical order (CORS first, error handling last)
5. **Use dependency injection**: Inject services into middleware constructors
6. **Test middleware**: Write unit tests for middleware logic
7. **Performance considerations**: Avoid heavy operations in frequently called middleware
8. **Conditional application**: Use route filters to apply middleware selectively
