# Getting Started

Since Deepkit HTTP is based on Runtime Types, it is necessary to have Runtime Types already installed correctly. See [Runtime Type Installation](../runtime-types/getting-started.md).

If this is done successfully, `@deepkit/app` can be installed or the Deepkit framework which already uses the library under the hood.

```sh
npm install @deepkit/http
```

Note that `@deepkit/http` for the controller API is based on TypeScript annotations and this feature must be enabled accordingly with `experimentalDecorators` once the controller API is used.
If you don't use classes, you don't need to enable this feature.

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

Once the library is installed, the API of it can be used directly.

## Functional API

The functional API is based on functions and can be registered via the router registry, which can be obtained via the DI container of the app.

```typescript
import { App } from '@deepkit/app';
import { FrameworkModule } from '@deepkit/framework';
import { HttpRouterRegistry } from '@deepkit/http';

const app = new App({
    imports: [new FrameworkModule]
});

const router = app.get(HttpRouterRegistry);

router.get('/', () => {
    return "Hello World!";
});

app.run();
```

Once modules are used, functional routes can also be provided dynamically by modules.

```typescript
import { App, createModuleClass } from '@deepkit/app';
import { FrameworkModule } from '@deepkit/framework';
import { HttpRouterRegistry } from '@deepkit/http';

class MyModule extends createModuleClass({}) {
  override process() {
    this.configureProvider<HttpRouterRegistry>(router => {
      router.get('/', () => {
        return "Hello World!";
      });
    });
  }
}

const app = new App({
  imports: [new FrameworkModule, new MyModule]
});
```

See [Framework Modules](../app/modules), to learn more about App Modules.

## Controller API

The controller API is based on classes and can be registered via the App-API under the option `controllers`.

```typescript
import { App } from '@deepkit/app';
import { FrameworkModule } from '@deepkit/framework';
import { http } from '@deepkit/http';

class MyPage {
    @http.GET('/')
    helloWorld() {
        return "Hello World!";
    }
}

new App({
    controllers: [MyPage],
    imports: [new FrameworkModule]
}).run();
```

Once modules are used, controllers can also be provided by modules.

```typescript
import { App, createModuleClass } from '@deepkit/app';
import { FrameworkModule } from '@deepkit/framework';
import { http } from '@deepkit/http';

class MyPage {
  @http.GET('/')
  helloWorld() {
    return "Hello World!";
  }
}

class MyModule extends createModuleClass({}) {
  override process() {
    this.addController(MyPage);
  }
}

const app = new App({
  imports: [new FrameworkModule, new MyModule]
});
```

To provide controllers dynamically (depending on the configuration option, for example), the `process` hook can be used.

```typescript
class MyModuleConfiguration {
    debug: boolean = false;
}

class MyModule extends createModuleClass({
    config: MyModuleConfiguration
}) {
    override process() {
        if (this.config.debug) {
            class DebugController {
                @http.GET('/debug/')
                root() {
                    return 'Hello Debugger';
                }
            }
            this.addController(DebugController);
        }
    }
}
```

See [Framework Modules](../app/modules), to learn more about App Modules.

## HTTP Server

If Deepkit Framework is used, an HTTP server is already built in. However, the HTTP library can also be used with its own HTTP server without using the Deepkit framework.

```typescript
import { Server } from 'http';
import { HttpRequest, HttpResponse } from '@deepkit/http';

const app = new App({
    controllers: [MyPage],
    imports: [new HttpModule]
});

const httpKernel = app.get(HttpKernel);

new Server(
    { IncomingMessage: HttpRequest, ServerResponse: HttpResponse, },
    ((req, res) => {
        httpKernel.handleRequest(req as HttpRequest, res as HttpResponse);
    })
).listen(8080, () => {
    console.log('listen at 8080');
});
```

## Testing

Deepkit HTTP provides comprehensive testing utilities that allow you to test your HTTP applications without starting an actual server:

```typescript
import { expect, test } from '@jest/globals';
import { createTestingApp } from '@deepkit/framework';
import { HttpRequest } from '@deepkit/http';

class UserController {
    @http.GET('/users/:id')
    getUser(id: number) {
        return { id, name: `User ${id}` };
    }
}

test('user controller', async () => {
    const testing = createTestingApp({
        controllers: [UserController]
    });

    const response = await testing.request(HttpRequest.GET('/users/42'));
    expect(response.statusCode).toBe(200);
    expect(response.json).toEqual({ id: 42, name: 'User 42' });
});
```

For more comprehensive testing examples, see the [Testing](testing.md) documentation.

## HTTP Client

Deepkit HTTP provides utilities for making HTTP requests with automatic validation and type casting:

```typescript
import { HttpRequest } from '@deepkit/http';

// Create requests with fluent API
const request = HttpRequest.POST('/api/users')
    .json({ name: 'John', email: 'john@example.com' })
    .header('Authorization', 'Bearer token123')
    .build();

// For file uploads
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
```

## Route Names

Routes can be given a unique name that can be referenced when forwarding. Depending on the API, the way a name is defined differs.

```typescript
//functional API
router.get({
    path: '/user/:id',
    name: 'userDetail'
}, (id: number) => {
    return {userId: id};
});

//controller API
class UserController {
    @http.GET('/user/:id').name('userDetail')
    userDetail(id: number) {
        return {userId: id};
    }
}
```

From all routes with a name the URL can be requested by `Router.resolveUrl()`.

```typescript
import { HttpRouter } from '@deepkit/http';
const router = app.get(HttpRouter);
router.resolveUrl('userDetail', {id: 2}); //=> '/user/2'
```

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

## Next Steps

- **[Input & Output](input-output.md)**: Learn about handling request data and responses
- **[Security](security.md)**: Implement authentication, authorization, and security best practices
- **[Middleware](middleware.md)**: Add custom middleware for cross-cutting concerns
- **[Events](events.md)**: Hook into the HTTP request lifecycle with events
- **[Testing](testing.md)**: Write comprehensive tests for your HTTP applications
- **[Dependency Injection](dependency-injection.md)**: Use DI for better code organization

