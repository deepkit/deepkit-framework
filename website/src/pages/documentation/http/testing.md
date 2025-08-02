# Testing

Testing HTTP applications is crucial for ensuring reliability and correctness. Deepkit HTTP provides comprehensive testing utilities that make it easy to test controllers, middleware, and entire HTTP workflows without starting an actual server.

## Testing Setup

Deepkit provides testing utilities through the `@deepkit/framework` package:

```typescript
import { expect, test } from '@jest/globals';
import { createTestingApp } from '@deepkit/framework';
import { HttpRequest } from '@deepkit/http';

test('basic http test', async () => {
    const testing = createTestingApp({
        controllers: [MyController],
        providers: [MyService]
    });

    await testing.startServer();

    try {
        const response = await testing.request(HttpRequest.GET('/hello/World'));
        expect(response.statusCode).toBe(200);
        expect(response.json).toBe("Hello World!");
    } finally {
        await testing.stopServer();
    }
});
```

## Testing Controllers

### Basic Controller Testing

```typescript
import { http } from '@deepkit/http';

class UserController {
    @http.GET('/users/:id')
    getUser(id: number) {
        return { id, name: `User ${id}` };
    }
    
    @http.POST('/users')
    createUser(userData: { name: string, email: string }) {
        return { id: 123, ...userData };
    }
}

test('user controller', async () => {
    const testing = createTestingApp({
        controllers: [UserController]
    });

    // Test GET request
    const getResponse = await testing.request(HttpRequest.GET('/users/42'));
    expect(getResponse.statusCode).toBe(200);
    expect(getResponse.json).toEqual({ id: 42, name: 'User 42' });

    // Test POST request
    const postResponse = await testing.request(
        HttpRequest.POST('/users').json({ name: 'John', email: 'john@example.com' })
    );
    expect(postResponse.statusCode).toBe(200);
    expect(postResponse.json).toEqual({ 
        id: 123, 
        name: 'John', 
        email: 'john@example.com' 
    });
});
```

### Testing with Dependencies

```typescript
class UserService {
    getUser(id: number) {
        return { id, name: `User ${id}`, email: `user${id}@example.com` };
    }
}

class UserController {
    constructor(private userService: UserService) {}
    
    @http.GET('/users/:id')
    getUser(id: number) {
        return this.userService.getUser(id);
    }
}

test('controller with dependencies', async () => {
    const testing = createTestingApp({
        controllers: [UserController],
        providers: [UserService]
    });

    const response = await testing.request(HttpRequest.GET('/users/1'));
    expect(response.json).toEqual({
        id: 1,
        name: 'User 1',
        email: 'user1@example.com'
    });
});
```

## Testing Authentication & Authorization

```typescript
class AuthController {
    @http.POST('/login')
    login(credentials: { username: string, password: string }) {
        if (credentials.username === 'admin' && credentials.password === 'secret') {
            return { token: 'valid-token', user: { username: 'admin' } };
        }
        throw new HttpUnauthorizedError('Invalid credentials');
    }
    
    @http.GET('/profile')
    getProfile(user: User) {
        return user;
    }
}

test('authentication', async () => {
    const testing = createTestingApp({
        controllers: [AuthController],
        providers: [
            {
                provide: User,
                scope: 'http',
                useFactory: () => {
                    throw new Error('User must be set via injector context during authentication');
                }
            }
        ]
    });

    // Add authentication listener for testing
    testing.app.listen(httpWorkflow.onAuth, (event) => {
        const auth = event.request.headers.authorization;
        if (auth === 'Bearer valid-token') {
            const user = new User('admin', 1);
            event.injectorContext.set(User, user);
        } else {
            throw new HttpUnauthorizedError('Invalid token');
        }
    });

    // Test login
    const loginResponse = await testing.request(
        HttpRequest.POST('/login').json({ username: 'admin', password: 'secret' })
    );
    expect(loginResponse.statusCode).toBe(200);
    expect(loginResponse.json.token).toBe('valid-token');

    // Test protected route
    const profileResponse = await testing.request(
        HttpRequest.GET('/profile').header('authorization', 'Bearer valid-token')
    );
    expect(profileResponse.statusCode).toBe(200);
    expect(profileResponse.json.username).toBe('admin');

    // Test unauthorized access
    const unauthorizedResponse = await testing.request(HttpRequest.GET('/profile'));
    expect(unauthorizedResponse.statusCode).toBe(401);
});
```

## Testing Middleware

```typescript
import { HttpMiddleware, httpMiddleware } from '@deepkit/http';

class LoggingMiddleware implements HttpMiddleware {
    constructor(private logs: string[] = []) {}
    
    async execute(request: HttpRequest, response: HttpResponse, next: (err?: any) => void) {
        this.logs.push(`${request.method} ${request.url}`);
        next();
    }
}

test('middleware', async () => {
    const logs: string[] = [];
    const loggingMiddleware = new LoggingMiddleware(logs);
    
    const testing = createTestingApp({
        controllers: [UserController],
        providers: [loggingMiddleware],
        middlewares: [httpMiddleware.for(LoggingMiddleware)]
    });

    await testing.request(HttpRequest.GET('/users/1'));
    expect(logs).toContain('GET /users/1');
});
```

## Testing File Uploads

```typescript
import { UploadedFile } from '@deepkit/http';

class FileController {
    @http.POST('/upload')
    uploadFile(file: UploadedFile) {
        return { 
            name: file.name, 
            size: file.size, 
            type: file.type 
        };
    }
}

test('file upload', async () => {
    const testing = createTestingApp({
        controllers: [FileController]
    });

    const response = await testing.request(
        HttpRequest.POST('/upload').multiPart([
            {
                name: 'file',
                file: Buffer.from('test file content'),
                fileName: 'test.txt'
            }
        ])
    );

    expect(response.statusCode).toBe(200);
    expect(response.json).toMatchObject({
        name: 'test.txt',
        size: 17,
        type: 'application/octet-stream'
    });
});
```

## Testing Error Handling

```typescript
test('error handling', async () => {
    class ErrorController {
        @http.GET('/error')
        throwError() {
            throw new HttpBadRequestError('Something went wrong');
        }
    }

    const testing = createTestingApp({
        controllers: [ErrorController]
    });

    const response = await testing.request(HttpRequest.GET('/error'));
    expect(response.statusCode).toBe(400);
    expect(response.json.message).toBe('Something went wrong');
});
```

## Testing Functional Routes

```typescript
test('functional routes', async () => {
    const testing = createTestingApp({});
    
    const router = testing.app.get(HttpRouterRegistry);
    
    router.get('/hello/:name', (name: string) => {
        return `Hello ${name}`;
    });
    
    router.post('/echo', (body: HttpBody<{ message: string }>) => {
        return { echo: body.message };
    });

    const getResponse = await testing.request(HttpRequest.GET('/hello/World'));
    expect(getResponse.json).toBe('Hello World');

    const postResponse = await testing.request(
        HttpRequest.POST('/echo').json({ message: 'test' })
    );
    expect(postResponse.json).toEqual({ echo: 'test' });
});
```

## Mock Services

```typescript
class DatabaseService {
    async getUser(id: number) {
        // Real implementation would query database
        throw new Error('Database not available in tests');
    }
}

class MockDatabaseService {
    async getUser(id: number) {
        return { id, name: `Mock User ${id}` };
    }
}

test('with mocked services', async () => {
    const testing = createTestingApp({
        controllers: [UserController],
        providers: [
            { provide: DatabaseService, useClass: MockDatabaseService }
        ]
    });

    const response = await testing.request(HttpRequest.GET('/users/1'));
    expect(response.json.name).toBe('Mock User 1');
});
```

## Integration Testing

```typescript
test('full integration test', async () => {
    const testing = createTestingApp({
        controllers: [UserController, AuthController],
        providers: [UserService, AuthService],
        middlewares: [httpMiddleware.for(LoggingMiddleware)]
    });

    // Test complete user flow
    const loginResponse = await testing.request(
        HttpRequest.POST('/login').json({ username: 'admin', password: 'secret' })
    );
    
    const token = loginResponse.json.token;
    
    const userResponse = await testing.request(
        HttpRequest.GET('/users/me').header('authorization', `Bearer ${token}`)
    );
    
    expect(userResponse.statusCode).toBe(200);
    expect(userResponse.json.username).toBe('admin');
});
```

## Best Practices

1. **Use testing utilities**: Always use `createTestingApp` for HTTP testing
2. **Test both success and error cases**: Ensure proper error handling
3. **Mock external dependencies**: Use mock services for databases, APIs, etc.
4. **Test authentication flows**: Verify both authorized and unauthorized access
5. **Test input validation**: Ensure proper validation of request data
6. **Test middleware**: Verify middleware behavior in isolation
7. **Use proper assertions**: Check status codes, response bodies, and headers
8. **Clean up resources**: Always stop the testing server in finally blocks
9. **Test edge cases**: Include boundary conditions and invalid inputs
10. **Integration tests**: Test complete user workflows end-to-end
