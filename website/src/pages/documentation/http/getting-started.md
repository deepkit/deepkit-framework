# Getting Started

Deepkit HTTP is a modern, type-safe HTTP framework that leverages TypeScript's type system to provide automatic validation, serialization, and powerful development tools. Unlike traditional HTTP frameworks, Deepkit HTTP uses runtime type information to automatically handle request/response processing, making your applications more robust and developer-friendly.

## Key Features

- **Type-Safe by Design**: Automatic validation and serialization based on TypeScript types
- **Zero Configuration**: No need for manual validation schemas or serialization setup
- **Flexible Architecture**: Support both functional and class-based (controller) APIs
- **Powerful Event System**: Hook into any part of the HTTP request lifecycle
- **Built-in Testing**: Comprehensive testing utilities without starting actual servers
- **Dependency Injection**: Full DI support with HTTP-scoped providers

## Prerequisites

Since Deepkit HTTP is built on Runtime Types, you need to have Runtime Types properly configured. This enables the framework to understand your TypeScript types at runtime for automatic validation and serialization.

See [Runtime Type Installation](../runtime-types/getting-started.md) for detailed setup instructions.

## Installation

Install the HTTP package:

```sh
npm install @deepkit/http
```

Or use the full Deepkit Framework which includes HTTP functionality:

```sh
npm install @deepkit/framework
```

## TypeScript Configuration

For the controller API (class-based routes), you need to enable experimental decorators in your TypeScript configuration:

_File: tsconfig.json_

```json
{
  "compilerOptions": {
    "module": "CommonJS",
    "target": "es6",
    "moduleResolution": "node",
    "experimentalDecorators": true
  },
  "reflection": true
}
```

**Note**: If you only use the functional API (function-based routes), experimental decorators are not required.

## Architecture Overview

Deepkit HTTP provides two complementary APIs for building HTTP applications:

1. **Functional API**: Simple functions registered with a router - great for microservices and simple APIs
2. **Controller API**: Class-based controllers with decorators - ideal for larger applications with complex routing

Both APIs share the same underlying features: automatic validation, serialization, dependency injection, and event system.

## Functional API

The functional API provides a simple, straightforward way to define HTTP routes using plain functions. This approach is perfect for microservices, simple APIs, or when you prefer a more functional programming style.

### Why Use the Functional API?

- **Simplicity**: Direct function-to-route mapping with minimal boilerplate
- **Flexibility**: Easy to organize routes across multiple files
- **Testing**: Functions are easy to unit test in isolation
- **Performance**: Minimal overhead with direct function calls

### Basic Functional Routes

Routes are registered through the `HttpRouterRegistry`, which you can access via the dependency injection container:

```typescript
import { App } from '@deepkit/app';
import { FrameworkModule } from '@deepkit/framework';
import { HttpRouterRegistry } from '@deepkit/http';

const app = new App({
    imports: [new FrameworkModule]
});

const router = app.get(HttpRouterRegistry);

// Simple GET route
router.get('/', () => {
    return "Hello World!";
});

// Route with path parameters - automatically typed and validated
router.get('/users/:id', (id: number) => {
    return { userId: id, name: `User ${id}` };
});

// POST route with request body - automatically validated
router.post('/users', (userData: { name: string; email: string }) => {
    return { message: 'User created', data: userData };
});

app.run();
```

### Module-Based Route Organization

For larger applications, you can organize routes within modules. This provides better structure and allows for modular development:

```typescript
import { App, createModuleClass } from '@deepkit/app';
import { FrameworkModule } from '@deepkit/framework';
import { HttpRouterRegistry } from '@deepkit/http';

class ApiModule extends createModuleClass({}) {
  override process() {
    // Configure routes when the module is processed
    this.configureProvider<HttpRouterRegistry>(router => {
      router.get('/api/health', () => {
        return { status: 'healthy', timestamp: new Date() };
      });

      router.get('/api/version', () => {
        return { version: '1.0.0' };
      });
    });
  }
}

const app = new App({
  imports: [new FrameworkModule, new ApiModule]
});
```

This modular approach allows you to:
- **Separate concerns**: Group related routes together
- **Reuse modules**: Share common functionality across applications
- **Conditional loading**: Load modules based on configuration
- **Better testing**: Test modules in isolation

See [Framework Modules](../app/modules) to learn more about App Modules.

## Controller API

The controller API uses classes with decorators to define HTTP routes. This approach is ideal for larger applications where you need better organization, shared state, dependency injection, and more structured routing.

### Why Use the Controller API?

- **Organization**: Group related routes in logical classes
- **Dependency Injection**: Easy access to services via constructor injection
- **Shared State**: Controllers can maintain state across requests
- **Middleware**: Apply middleware at the controller or method level
- **Inheritance**: Share common functionality through class inheritance
- **Metadata**: Rich decorator-based configuration

### Basic Controller

Controllers are classes with methods decorated with HTTP verb decorators:

```typescript
import { App } from '@deepkit/app';
import { FrameworkModule } from '@deepkit/framework';
import { http } from '@deepkit/http';

class UserController {
    @http.GET('/')
    welcome() {
        return "Welcome to the User API!";
    }

    @http.GET('/users/:id')
    getUser(id: number) {
        // Path parameter 'id' is automatically extracted and validated as number
        return { id, name: `User ${id}`, email: `user${id}@example.com` };
    }

    @http.POST('/users')
    createUser(userData: { name: string; email: string }) {
        // Request body is automatically validated against the type
        return { message: 'User created', data: userData };
    }
}

new App({
    controllers: [UserController],
    imports: [new FrameworkModule]
}).run();
```

### Controller with Dependencies

Controllers can inject services through their constructor, making them powerful for complex business logic:

```typescript
class UserService {
    async findUser(id: number) {
        // Database logic here
        return { id, name: `User ${id}` };
    }
}

class UserController {
    constructor(private userService: UserService) {}

    @http.GET('/users/:id')
    async getUser(id: number) {
        return await this.userService.findUser(id);
    }
}

new App({
    controllers: [UserController],
    providers: [UserService],
    imports: [new FrameworkModule]
}).run();
```

### Module-Based Controllers

Controllers can be organized within modules for better structure:

```typescript
import { App, createModuleClass } from '@deepkit/app';
import { FrameworkModule } from '@deepkit/framework';
import { http } from '@deepkit/http';

class ApiController {
  @http.GET('/api/status')
  getStatus() {
    return { status: 'running', uptime: process.uptime() };
  }
}

class ApiModule extends createModuleClass({}) {
  override process() {
    this.addController(ApiController);
  }
}

const app = new App({
  imports: [new FrameworkModule, new ApiModule]
});
```

### Dynamic Controller Registration

Controllers can be registered conditionally based on configuration:

```typescript
class MyModuleConfiguration {
    debug: boolean = false;
    enableAdmin: boolean = false;
}

class MyModule extends createModuleClass({
    config: MyModuleConfiguration
}) {
    override process() {
        // Always add the main controller
        this.addController(MainController);

        // Conditionally add debug controller
        if (this.config.debug) {
            class DebugController {
                @http.GET('/debug/info')
                getDebugInfo() {
                    return {
                        environment: process.env.NODE_ENV,
                        memory: process.memoryUsage(),
                        uptime: process.uptime()
                    };
                }
            }
            this.addController(DebugController);
        }

        // Conditionally add admin controller
        if (this.config.enableAdmin) {
            this.addController(AdminController);
        }
    }
}
```

This pattern allows you to:
- **Feature flags**: Enable/disable entire controller sets
- **Environment-specific routes**: Different routes for development vs production
- **Modular architecture**: Load controllers based on installed modules

See [Framework Modules](../app/modules) to learn more about App Modules.

## HTTP Server Integration

Deepkit HTTP is designed to work seamlessly with different server setups. Understanding how the HTTP server integration works helps you choose the right approach for your application.

### Using Deepkit Framework (Recommended)

When using the full Deepkit Framework, an HTTP server is automatically configured and managed for you. This is the easiest and most feature-complete approach:

```typescript
import { App } from '@deepkit/app';
import { FrameworkModule } from '@deepkit/framework';

const app = new App({
    controllers: [UserController],
    imports: [new FrameworkModule]
});

// Server automatically starts on app.run()
app.run(); // Defaults to http://localhost:8080
```

The framework handles:
- **Server lifecycle**: Automatic startup and graceful shutdown
- **Configuration**: Port, host, and other server settings
- **Error handling**: Proper error responses and logging
- **Performance**: Optimized request processing

### Standalone HTTP Server

For more control or integration with existing Node.js applications, you can use Deepkit HTTP with a custom server:

```typescript
import { Server } from 'http';
import { App } from '@deepkit/app';
import { HttpModule, HttpKernel, HttpRequest, HttpResponse } from '@deepkit/http';

const app = new App({
    controllers: [UserController],
    imports: [new HttpModule] // Note: HttpModule instead of FrameworkModule
});

const httpKernel = app.get(HttpKernel);

const server = new Server(
    {
        IncomingMessage: HttpRequest,
        ServerResponse: HttpResponse
    },
    (req, res) => {
        httpKernel.handleRequest(req as HttpRequest, res as HttpResponse);
    }
);

server.listen(8080, () => {
    console.log('Server listening on http://localhost:8080');
});
```

This approach gives you:
- **Full control**: Manage server lifecycle yourself
- **Custom configuration**: Set up HTTPS, clustering, etc.
- **Integration**: Embed in existing applications
- **Flexibility**: Use with other HTTP frameworks

## Testing Your HTTP Application

One of Deepkit HTTP's greatest strengths is its built-in testing capabilities. You can test your entire HTTP application without starting an actual server, making tests fast, reliable, and easy to write.

### Why Deepkit's Testing is Powerful

- **No Server Required**: Tests run in-memory without network overhead
- **Full Integration**: Test the complete request/response cycle
- **Type Safety**: Same type checking in tests as in production
- **Fast Execution**: No network latency or port conflicts
- **Easy Mocking**: Simple dependency injection for test doubles

### Basic Testing Example

```typescript
import { expect, test } from '@jest/globals';
import { createTestingApp } from '@deepkit/framework';
import { HttpRequest } from '@deepkit/http';

class UserController {
    @http.GET('/users/:id')
    getUser(id: number) {
        return { id, name: `User ${id}` };
    }

    @http.POST('/users')
    createUser(userData: { name: string; email: string }) {
        return { id: 123, ...userData };
    }
}

test('user controller', async () => {
    const testing = createTestingApp({
        controllers: [UserController]
    });

    // Test GET request with path parameter
    const getResponse = await testing.request(HttpRequest.GET('/users/42'));
    expect(getResponse.statusCode).toBe(200);
    expect(getResponse.json).toEqual({ id: 42, name: 'User 42' });

    // Test POST request with JSON body
    const postResponse = await testing.request(
        HttpRequest.POST('/users').json({ name: 'John', email: 'john@example.com' })
    );
    expect(postResponse.statusCode).toBe(200);
    expect(postResponse.json.name).toBe('John');
});
```

### Testing with Dependencies

```typescript
class UserService {
    async findUser(id: number) {
        // In real app, this would query a database
        return { id, name: `User ${id}`, email: `user${id}@example.com` };
    }
}

class MockUserService {
    async findUser(id: number) {
        return { id, name: `Test User ${id}`, email: `test${id}@example.com` };
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

The testing system automatically handles:
- **Request parsing**: Body, headers, query parameters
- **Validation**: Same validation as production
- **Dependency injection**: Full DI container with mocking support
- **Response serialization**: JSON, HTML, and custom responses

For comprehensive testing strategies and advanced patterns, see the [Testing](testing.md) documentation.

## HTTP Client Utilities

Deepkit HTTP includes powerful client utilities for making HTTP requests, particularly useful for testing and inter-service communication. These utilities provide a fluent API with automatic type handling.

### Why Use Deepkit's HTTP Client?

- **Type Safety**: Automatic serialization and validation
- **Fluent API**: Chainable methods for building requests
- **Testing Integration**: Perfect for integration tests
- **Consistent Interface**: Same patterns as server-side code

### Making HTTP Requests

```typescript
import { HttpRequest } from '@deepkit/http';

// Simple GET request
const getRequest = HttpRequest.GET('/api/users/123');

// POST request with JSON body
const postRequest = HttpRequest.POST('/api/users')
    .json({ name: 'John', email: 'john@example.com' })
    .header('Authorization', 'Bearer token123');

// PUT request with custom headers
const putRequest = HttpRequest.PUT('/api/users/123')
    .json({ name: 'John Updated' })
    .header('Content-Type', 'application/json')
    .header('X-API-Version', '2.0');
```

### File Uploads

The client supports multipart form data for file uploads:

```typescript
// Single file upload
const uploadRequest = HttpRequest.POST('/upload')
    .multiPart([
        {
            name: 'file',
            file: Buffer.from('file content'),
            fileName: 'document.txt'
        },
        {
            name: 'description',
            value: 'Important document'
        }
    ]);

// Multiple files with metadata
const multiUploadRequest = HttpRequest.POST('/upload-multiple')
    .multiPart([
        {
            name: 'files',
            file: Buffer.from('first file'),
            fileName: 'file1.txt'
        },
        {
            name: 'files',
            file: Buffer.from('second file'),
            fileName: 'file2.txt'
        },
        {
            name: 'category',
            value: 'documents'
        }
    ]);
```

### Using in Tests

The HTTP client is particularly powerful when combined with the testing utilities:

```typescript
test('API integration', async () => {
    const testing = createTestingApp({ controllers: [ApiController] });

    // Test the complete request/response cycle
    const response = await testing.request(
        HttpRequest.POST('/api/users')
            .json({ name: 'Test User', email: 'test@example.com' })
            .header('Authorization', 'Bearer test-token')
    );

    expect(response.statusCode).toBe(201);
    expect(response.json.name).toBe('Test User');
});
```

## Route Names and URL Generation

Route names provide a powerful way to reference routes throughout your application without hardcoding URLs. This makes your application more maintainable and allows for easy URL changes without breaking references.

### Why Use Route Names?

- **Maintainability**: Change URLs in one place without breaking references
- **Type Safety**: Generate URLs with compile-time parameter checking
- **Consistency**: Ensure all URL references are valid
- **Refactoring**: Safely rename routes across your application

### Defining Named Routes

Route names can be defined differently depending on which API you're using:

```typescript
// Functional API - using route configuration object
router.get({
    path: '/user/:id',
    name: 'userDetail'
}, (id: number) => {
    return { userId: id, name: `User ${id}` };
});

router.post({
    path: '/user/:id/posts',
    name: 'createUserPost'
}, (id: number, postData: { title: string; content: string }) => {
    return { message: 'Post created', userId: id };
});

// Controller API - using the name() method
class UserController {
    @http.GET('/user/:id').name('userDetail')
    userDetail(id: number) {
        return { userId: id, name: `User ${id}` };
    }

    @http.GET('/user/:id/posts').name('userPosts')
    getUserPosts(id: number) {
        return { posts: [], userId: id };
    }
}
```

### Generating URLs from Route Names

Once routes are named, you can generate URLs programmatically using the `HttpRouter`:

```typescript
import { HttpRouter } from '@deepkit/http';

class LinkService {
    constructor(private router: HttpRouter) {}

    getUserProfileUrl(userId: number): string {
        return this.router.resolveUrl('userDetail', { id: userId });
        // Returns: '/user/123'
    }

    getUserPostsUrl(userId: number): string {
        return this.router.resolveUrl('userPosts', { id: userId });
        // Returns: '/user/123/posts'
    }
}
```

### Using Route Names in Controllers

Route names are particularly useful for redirects and generating links in responses:

```typescript
import { Redirect } from '@deepkit/http';

class UserController {
    @http.POST('/users').name('createUser')
    createUser(userData: { name: string; email: string }) {
        const newUser = { id: 123, ...userData };

        // Redirect to the user detail page using route name
        return Redirect.toRoute('userDetail', { id: newUser.id });
    }

    @http.GET('/users/:id').name('userDetail')
    getUser(id: number, router: HttpRouter) {
        const user = { id, name: `User ${id}` };

        return {
            ...user,
            links: {
                self: router.resolveUrl('userDetail', { id }),
                posts: router.resolveUrl('userPosts', { id })
            }
        };
    }
}
```

This approach creates a robust, maintainable URL structure throughout your application.

## Error Handling

Deepkit HTTP provides built-in error classes for common HTTP errors:

```typescript
import {
    HttpBadRequestError,
    HttpUnauthorizedError,
    HttpNotFoundError,
    HttpAccessDeniedError
} from '@deepkit/http';

class UserController {
    @http.GET('/users/:id')
    getUser(id: number) {
        if (id <= 0) {
            throw new HttpBadRequestError('Invalid user ID');
        }

        const user = findUser(id);
        if (!user) {
            throw new HttpNotFoundError('User not found');
        }

        return user;
    }

    @http.DELETE('/users/:id')
    deleteUser(id: number, currentUser: User) {
        if (!currentUser) {
            throw new HttpUnauthorizedError('Authentication required');
        }

        if (!currentUser.canDelete(id)) {
            throw new HttpAccessDeniedError('Insufficient permissions');
        }

        deleteUser(id);
        return { success: true };
    }
}
```

## Configuration

Configure HTTP behavior through the HttpConfig:

```typescript
import { HttpConfig } from '@deepkit/http';

const httpConfig = new HttpConfig();
httpConfig.port = 3000;
httpConfig.host = '0.0.0.0';
httpConfig.parser.multipartJsonKey = 'json';
httpConfig.parser.maxFileSize = 10 * 1024 * 1024; // 10MB

const app = new App({
    config: { http: httpConfig },
    imports: [new FrameworkModule]
});
```

## Choosing Between Functional and Controller APIs

Both APIs have their strengths and can even be used together in the same application:

### Use Functional API When:
- Building microservices or simple APIs
- You prefer functional programming patterns
- Routes are simple and don't share much logic
- You want minimal boilerplate
- Building serverless functions

### Use Controller API When:
- Building larger applications with complex routing
- You need shared state or logic across routes
- You want to group related functionality
- You prefer object-oriented patterns
- You need extensive middleware or decorators

### Hybrid Approach
```typescript
const app = new App({
    controllers: [UserController, AdminController], // Complex features
    imports: [new FrameworkModule]
});

const router = app.get(HttpRouterRegistry);

// Simple utility routes as functions
router.get('/health', () => ({ status: 'ok', timestamp: new Date() }));
router.get('/version', () => ({ version: '1.0.0' }));
```

## Next Steps

Now that you understand the basics, explore these topics to build production-ready applications:

- **[Input & Output](input-output.md)**: Master request data handling, validation, and response types
- **[Security](security.md)**: Implement authentication, authorization, and security best practices
- **[Middleware](middleware.md)**: Add cross-cutting concerns like logging, CORS, and rate limiting
- **[Events](events.md)**: Hook into the HTTP request lifecycle for advanced customization
- **[Testing](testing.md)**: Write comprehensive tests for your HTTP applications
- **[Dependency Injection](dependency-injection.md)**: Leverage DI for clean, maintainable code
- **[Views](views.md)**: Build server-side rendered HTML with type-safe JSX templates

## Quick Reference

### Common Patterns

```typescript
// Path parameters with validation
router.get('/users/:id', (id: number & Positive) => { /* ... */ });

// Query parameters with defaults
router.get('/posts', (page: HttpQuery<number> = 1) => { /* ... */ });

// Request body validation
router.post('/users', (userData: HttpBody<CreateUserRequest>) => { /* ... */ });

// Dependency injection
router.get('/data', (database: Database, logger: Logger) => { /* ... */ });

// Error handling
router.get('/risky', () => {
    if (Math.random() > 0.5) {
        throw new HttpBadRequestError('Random error');
    }
    return { success: true };
});
```

### Essential Imports

```typescript
import { App } from '@deepkit/app';
import { FrameworkModule } from '@deepkit/framework';
import {
    http,
    HttpRouterRegistry,
    HttpBody,
    HttpQuery,
    HttpRequest,
    HttpResponse,
    HttpBadRequestError,
    HttpUnauthorizedError,
    HttpNotFoundError
} from '@deepkit/http';
```

