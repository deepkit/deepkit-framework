# Events

The HTTP module is based on a workflow engine that provides various event tokens that can be used to hook into the entire process of processing an HTTP request.

The workflow engine is a finite state machine that creates a new state machine instance for each HTTP request and then jumps from position to position. The first position is the `start` and the last the `response`. Additional code can be executed in each position.

![HTTP Workflow](/assets/documentation/framework/http-workflow.png)

Each event token has its own event type with additional information.

| Event-Token                   | Description                                                                                                         |
|-------------------------------|---------------------------------------------------------------------------------------------------------------------|
| httpWorkflow.onRequest        | When a new request comes in                                                                                         |
| httpWorkflow.onRoute          | When the route should be resolved from the request                                                                  |
| httpWorkflow.onRouteNotFound  | When the route is not found                                                                                         |
| httpWorkflow.onAuth           | When authentication happens                                                                                         |
| httpWorkflow.onResolveParameters | When route parameters are resolved                                                                                 |
| httpWorkflow.onAccessDenied   | When access is denied                                                                                               |
| httpWorkflow.onController     | When the controller action is called                                                                                |
| httpWorkflow.onControllerError | When the controller action threw an error                                                                           |
| httpWorkflow.onParametersFailed | When route parameters resolving failed                                                                             |
| httpWorkflow.onResponse       | When the controller action has been called. This is the place where the result is converted to a response.          |

Since all HTTP events are based on the workflow engine, its behavior can be modified by using the specified event and jumping there with the `event.next()` method.

The HTTP module uses its own event listeners on these event tokens to implement HTTP request processing. All these event listeners have a priority of 100, which means that when you listen for an event, your listener is executed first by default (since the default priority is 0). Add a priority above 100 to run after the HTTP default handler.

For example, suppose you want to catch the event when a controller is invoked. If a particular controller is to be invoked, we check if the user has access to it. If the user has access, we continue. But if not, we jump to the next workflow item `accessDenied`. There, the procedure of an access-denied is then automatically processed further.

```typescript
import { App } from '@deepkit/app';
import { FrameworkModule } from '@deepkit/framework';
import { HtmlResponse, http, httpAction, httpWorkflow } from '@deepkit/http';
import { eventDispatcher } from '@deepkit/event';

class MyWebsite {
    @http.GET('/')
    open() {
        return 'Welcome';
    }

    @http.GET('/admin').group('secret')
    secret() {
        return 'Welcome to the dark side';
    }
}

const app = new App({
    controllers: [MyWebsite],
    imports: [new FrameworkModule]
})

app.listen(httpWorkflow.onController, async (event) => {
    if (event.route.groups.includes('secret')) {
        //check here for authentication information like cookie session, JWT, etc.

        //this jumps to the 'accessDenied' workflow state,
        // essentially executing all onAccessDenied listeners.

        //since our listener is called before the HTTP kernel one,
        // the standard controller action will never be called.
        //this calls event.next('accessDenied', ...) under the hood
        event.accessDenied();
    }
});

/**
 * We change the default accessDenied implementation.
 */
app.listen(httpWorkflow.onAccessDenied, async () => {
    if (event.sent) return;
    if (event.hasNext()) return;
    event.send(new HtmlResponse('No access to this area.', 403));
})

app.run();
```

```sh
$ curl http://localhost:8080/
Welcome
$ curl http://localhost:8080/admin
No access to this area
```

## Advanced Event Examples

### Authentication with Events

```typescript
import { HttpQuery, HttpHeader, HttpPath } from '@deepkit/http';

class UserSession {
    constructor(public userId?: number, public username?: string) {}

    isAuthenticated(): boolean {
        return !!this.userId;
    }
}

const app = new App({
    providers: [
        {
            provide: UserSession,
            scope: 'http',
            useFactory: () => {
                throw new Error('UserSession must be set via injector context');
            }
        }
    ]
});

// Initialize session for each request
app.listen(httpWorkflow.onRequest, (event) => {
    const session = new UserSession();
    event.injectorContext.set(UserSession, session);
});

// Authentication using query parameters
app.listen(httpWorkflow.onAuth, (event, session: UserSession, auth: HttpQuery<string>) => {
    const validTokens = {
        'token123': { userId: 1, username: 'john' },
        'token456': { userId: 2, username: 'jane' }
    };

    const userData = validTokens[auth];
    if (userData) {
        session.userId = userData.userId;
        session.username = userData.username;
        // Update the session in injector context
        event.injectorContext.set(UserSession, session);
    }
});

// Authorization check in controller event
app.listen(httpWorkflow.onController, (event, session: UserSession) => {
    if (event.route.groups.includes('authenticated')) {
        if (!session.isAuthenticated()) {
            event.accessDenied();
        }
    }
});
```

### Parameter Injection in Events

```typescript
// Access path parameters in events
app.listen(httpWorkflow.onController, (event, groupId: HttpPath<number>, authorization?: HttpHeader<string>) => {
    // groupId is automatically extracted from the route path
    // authorization is extracted from headers

    if (groupId > 100) {
        if (authorization !== 'secretToken') {
            throw new HttpUnauthorizedError('Not authorized for this group');
        }
    }
});
```

### Body and Query Parameter Access

```typescript
interface AuthData {
    auth: string;
    userId: number;
}

class AuthenticatedUser {
    constructor(public auth: string, public userId: number) {}
}

const app = new App({
    providers: [
        {
            provide: AuthenticatedUser,
            scope: 'http',
            useFactory: () => {
                throw new Error('AuthenticatedUser must be set via injector context during authentication');
            }
        }
    ]
});

// Access both body and query parameters
app.listen(httpWorkflow.onAuth, (event, body: HttpBody<AuthData>, queries: HttpQueries) => {
    // For POST requests, auth comes from body
    // For GET requests, auth comes from query parameters
    const auth = body?.auth || queries.auth;
    const userId = body?.userId || parseInt(queries.userId as string);

    if (auth && userId) {
        const authenticatedUser = new AuthenticatedUser(auth, userId);
        event.injectorContext.set(AuthenticatedUser, authenticatedUser);
    }
});
```

### Custom Request Handling

```typescript
// Handle CORS preflight requests
app.listen(httpWorkflow.onRouteNotFound, (event) => {
    if (event.request.method === 'OPTIONS') {
        event.send(new JSONResponse(true, 200));
    }
});

// Custom 404 handling
app.listen(httpWorkflow.onRouteNotFound, (event) => {
    if (!event.sent) {
        event.send(new HtmlResponse(`
            <html>
                <body>
                    <h1>Page Not Found</h1>
                    <p>The requested page ${event.request.url} was not found.</p>
                </body>
            </html>
        `, 404));
    }
});
```

### Error Handling Events

```typescript
// Global error handler
app.listen(httpWorkflow.onControllerError, (event) => {
    const error = event.error;

    console.error('Controller error:', error);

    // Custom error responses based on error type
    if (error instanceof ValidationError) {
        event.send(new JSONResponse({
            error: 'Validation failed',
            details: error.errors
        }, 400));
    } else if (error instanceof HttpUnauthorizedError) {
        event.send(new JSONResponse({
            error: 'Authentication required'
        }, 401));
    } else {
        // Generic error response
        event.send(new JSONResponse({
            error: 'Internal server error'
        }, 500));
    }
});

// Parameter resolution error handling
app.listen(httpWorkflow.onParametersFailed, (event) => {
    console.error('Parameter resolution failed:', event.error);

    event.send(new JSONResponse({
        error: 'Invalid request parameters',
        message: event.error.message
    }, 400));
});
```

### Response Modification

```typescript
// Modify all responses
app.listen(httpWorkflow.onResponse, (event) => {
    // Add custom headers to all responses
    event.response.setHeader('X-API-Version', '1.0');
    event.response.setHeader('X-Request-ID', generateRequestId());

    // Add CORS headers
    event.response.setHeader('Access-Control-Allow-Origin', '*');
});

// Transform response data
app.listen(httpWorkflow.onResponse, (event) => {
    if (event.result && typeof event.result === 'object') {
        // Wrap all responses in a standard format
        const wrappedResult = {
            success: true,
            data: event.result,
            timestamp: new Date().toISOString()
        };

        event.send(new JSONResponse(wrappedResult));
    }
});
```

### Session Management with Events

```typescript
class HttpSession {
    private data = new Map<string, any>();

    set(key: string, value: any): void {
        this.data.set(key, value);
    }

    get<T>(key: string): T | undefined {
        return this.data.get(key);
    }
}

class SessionUser {
    constructor(public id: number, public username: string) {}
}

const app = new App({
    providers: [
        {
            provide: HttpSession,
            scope: 'http',
            useFactory: () => {
                throw new Error('HttpSession must be initialized via injector context');
            }
        },
        {
            provide: SessionUser,
            scope: 'http',
            useFactory: () => {
                throw new Error('SessionUser must be set via injector context during authentication');
            }
        }
    ]
});

// Session initialization
app.listen(httpWorkflow.onRequest, (event) => {
    const session = new HttpSession();
    // Initialize session data from cookies or headers
    const sessionId = event.request.headers['x-session-id'];
    if (sessionId) {
        // Load session data from storage
        session.set('sessionId', sessionId);
    }
    event.injectorContext.set(HttpSession, session);
});

// Session-based authentication
app.listen(httpWorkflow.onAuth, (event, session: HttpSession) => {
    const userData = session.get('user');
    if (userData) {
        const user = new SessionUser(userData.id, userData.username);
        event.injectorContext.set(SessionUser, user);
    }
});
```

### Request Validation Events

```typescript
// Custom request validation
app.listen(httpWorkflow.onResolveParameters, (event) => {
    // Validate request size
    const contentLength = parseInt(event.request.headers['content-length'] || '0');
    if (contentLength > 10 * 1024 * 1024) { // 10MB limit
        throw new HttpBadRequestError('Request too large');
    }

    // Validate content type for POST/PUT requests
    if (['POST', 'PUT'].includes(event.request.method)) {
        const contentType = event.request.headers['content-type'];
        if (!contentType || !contentType.includes('application/json')) {
            throw new HttpBadRequestError('Content-Type must be application/json');
        }
    }
});
```

### Logging and Monitoring

```typescript
// Request logging
app.listen(httpWorkflow.onRequest, (event) => {
    const startTime = Date.now();
    event.request.store.startTime = startTime;

    console.log(`[${new Date().toISOString()}] ${event.request.method} ${event.request.url} - Started`);
});

// Response logging
app.listen(httpWorkflow.onResponse, (event) => {
    const startTime = event.request.store.startTime;
    const duration = Date.now() - startTime;

    console.log(`[${new Date().toISOString()}] ${event.request.method} ${event.request.url} - ${event.response.statusCode} - ${duration}ms`);
});

// Error logging
app.listen(httpWorkflow.onControllerError, (event) => {
    console.error(`[${new Date().toISOString()}] Error in ${event.request.method} ${event.request.url}:`, event.error);
});
```

### Event Priority and Execution Order

```typescript
// High priority listener (runs first)
app.listen(httpWorkflow.onController, (event) => {
    console.log('High priority listener');
}, 200);

// Default priority listener
app.listen(httpWorkflow.onController, (event) => {
    console.log('Default priority listener');
});

// Low priority listener (runs last)
app.listen(httpWorkflow.onController, (event) => {
    console.log('Low priority listener');
}, -100);
```

### Conditional Event Handling

```typescript
// Only handle specific routes
app.listen(httpWorkflow.onController, (event) => {
    if (event.route.path.startsWith('/api/')) {
        // API-specific logic
        event.response.setHeader('X-API-Version', '2.0');
    }
});

// Handle based on HTTP method
app.listen(httpWorkflow.onController, (event) => {
    if (event.request.method === 'POST') {
        // POST-specific validation
        console.log('Processing POST request');
    }
});

// Handle based on route groups
app.listen(httpWorkflow.onController, (event) => {
    if (event.route.groups.includes('admin')) {
        // Admin-specific security checks
        console.log('Admin route accessed');
    }
});
```

### Event Data Access

```typescript
// Access all available data in events
app.listen(httpWorkflow.onController, (event) => {
    console.log('Route info:', {
        path: event.route.path,
        method: event.route.httpMethod,
        groups: event.route.groups,
        name: event.route.name
    });

    console.log('Request info:', {
        method: event.request.method,
        url: event.request.url,
        headers: event.request.headers,
        ip: event.request.ip
    });

    console.log('Controller info:', {
        className: event.controllerClass.name,
        methodName: event.methodName
    });
});
```

## Event Best Practices

1. **Use appropriate events**: Choose the right event for your use case
2. **Handle errors gracefully**: Always wrap event handlers in try-catch
3. **Consider performance**: Avoid heavy operations in frequently called events
4. **Use priority wisely**: Set appropriate priorities for event execution order
5. **Keep handlers focused**: Each event handler should have a single responsibility
6. **Test event handlers**: Write unit tests for complex event logic
7. **Document event dependencies**: Make clear what data your events expect
8. **Use dependency injection**: Inject services into event handlers when needed
