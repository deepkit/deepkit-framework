# Deepkit Framework

Deepkit Framework is a highly modular, scalable, and fast TypeScript framework for building web applications, APIs, and microservices.
It is designed to be as flexible as necessary and as structured as required, allowing developers to maintain high development speeds, both in the short term and the long term.

## Overview

Deepkit Framework provides a comprehensive set of features for modern web development:

### Core Features
- **Application Server** - HTTP and RPC servers with multi-process support
- **Dependency Injection** - Powerful service container with scoped providers
- **Real-time Communication** - WebSocket-based RPC with type safety
- **Database Integration** - Built-in ORM with migration support
- **Message Broker** - Inter-process communication and caching
- **Testing Utilities** - Comprehensive testing framework
- **Debug & Profiling** - Built-in debugging and performance tools

### Architecture
- **Modular Design** - Import only what you need
- **Type Safety** - Full TypeScript support throughout
- **Event-Driven** - Comprehensive event system
- **Multi-Process** - Worker process support for scalability
- **Cloud-Ready** - Built for modern deployment scenarios

## App and Framework Module

Deepkit Framework is based on [Deepkit App](./app.md) in `@deepkit/app` and provides the `FrameworkModule` module in `@deepkit/framework`, which can be imported in your `App`.

The `App` abstraction brings:

- CLI commands
- Configuration loading (environment, dotfiles, custom)
- Module system
- Powerful Service Container
- Registry and hooks for controllers, providers, listeners, and more

The `FrameworkModule` module brings additional features:

- **Application Server**
    - HTTP server with middleware support
    - RPC server with WebSocket communication
    - Multi-process load balancing
    - SSL/HTTPS support
    - Static file serving
- **Development Tools**
    - Interactive debugger and profiler
    - Database browser and migration tools
    - API documentation interface
    - Request/response logging
- **Production Features**
    - Message broker for inter-process communication
    - Distributed caching and locking
    - Session management
    - Graceful shutdown handling
- **Testing Support**
    - In-memory testing utilities
    - Mock services and adapters
    - Integration testing framework

You can write applications with or without the `FrameworkModule`.

## Installation

Deepkit Framework is based on [Deepkit App](./app.md). Make sure you followed its installation instructions.
If so you can install Deepkit framework and import the `FrameworkModule` in your `App`. 

```sh
npm install @deepkit/framework
```

```typescript
import { App } from '@deepkit/app';
import { FrameworkModule } from '@deepkit/framework';

const app = new App({
    imports: [new FrameworkModule({ debug: true })]
});

app.command('test', (logger: Logger) => {
    logger.log('Hello World!');
});

app.run();
```

Since the app now imports the `FrameworkModule`, we see there are more commands available grouped into topics.

One of them is `server:start`, which starts the HTTP server. To use it, we have to register at least one HTTP route.

```typescript
import { App } from '@deepkit/app';
import { HttpRouterRegistry } from '@deepkit/http';

const app = new App({
    imports: [new FrameworkModule({ debug: true })]
});

app.command('test', (logger: Logger) => {
    logger.log('Hello World!');
});


const router = app.get(HttpRouterRegistry);

router.get('/', () => {
    return 'Hello World';
})

app.run();
```

When you execute the `server:start` command again, you will see that the HTTP server is now started and the route `/` is available.

```sh
$ ./node_modules/.bin/ts-node ./app.ts server:start
```

```sh
$ curl http://localhost:8080/
Hello World
```

To serve requests please read chapter [HTTP](http.md) or [RPC](rpc.md). In chapter [App](app.md) you can learn more about CLI commands.

## App

The `App` class is the main entry point for your application. It is responsible for loading all modules, configuration, and starting the application.
It is also responsible for loading all CLI commands and executing them. Modules like FrameworkModule provide additional commands, register event listeners,
provide controllers for HTTP/RPC, service providers and so on.

This `app` object can also be used to access the Dependency Injection container without running a CLI controller.

```typescript
const app = new App({
    imports: [new FrameworkModule]
});

//get access to all registered services
const eventDispatcher = app.get(EventDispatcher);
```

You can retrieve the `EventDispatcher` because the `FrameworkModule` registers it as a service provider like many other (Logger, ApplicationServer, and [much more](https://github.com/deepkit/deepkit-framework/blob/master/packages/framework/src/module.ts)).

You can also register your own service.

```typescript

class MyService {
    constructor(private logger: Logger) {
    }

    helloWorld() {
        this.logger.log('Hello World');
    }
}

const app = new App({
    providers: [MyService],
    imports: [new FrameworkModule]
});

const service = app.get(MyService);

service.helloWorld();
```

### Debugger

The configuration values of your application and all modules can be displayed in the debugger. Enable the debug option in `FrameworkModule` and open `http://localhost:8080/_debug/configuration`.

```typescript
import { App } from '@deepkit/app';
import { FrameworkModule } from '@deepkit/framework';

new App({
    config: Config,
    controllers: [MyWebsite],
    imports: [
        new FrameworkModule({
            debug: true,
        })
    ]
}).run();
```

![Debugger Configuration](/assets/documentation/framework/debugger-configuration.png)

You can also use `ts-node app.ts app:config` to display all available configuration options, the active value, their default value, description and data type.

```sh
$ ts-node app.ts app:config
Application config
┌─────────┬───────────────┬────────────────────────┬────────────────────────┬─────────────┬───────────┐
│ (index) │     name      │         value          │      defaultValue      │ description │   type    │
├─────────┼───────────────┼────────────────────────┼────────────────────────┼─────────────┼───────────┤
│    0    │  'pageTitle'  │     'Other title'      │      'Cool site'       │     ''      │ 'string'  │
│    1    │   'domain'    │     'example.com'      │     'example.com'      │     ''      │ 'string'  │
│    2    │    'port'     │          8080          │          8080          │     ''      │ 'number'  │
│    3    │ 'databaseUrl' │ 'mongodb://localhost/' │ 'mongodb://localhost/' │     ''      │ 'string'  │
│    4    │    'email'    │         false          │         false          │     ''      │ 'boolean' │
│    5    │ 'emailSender' │       undefined        │       undefined        │     ''      │ 'string?' │
└─────────┴───────────────┴────────────────────────┴────────────────────────┴─────────────┴───────────┘
Modules config
┌─────────┬──────────────────────────────┬─────────────────┬─────────────────┬────────────────────────────────────────────────────────────────────────────────────────────────────┬────────────┐
│ (index) │           name               │      value      │  defaultValue   │                                            description                                             │    type    │
├─────────┼──────────────────────────────┼─────────────────┼─────────────────┼────────────────────────────────────────────────────────────────────────────────────────────────────┼────────────┤
│    0    │       'framework.host'       │   'localhost'   │   'localhost'   │                                                 ''                                                 │  'string'  │
│    1    │       'framework.port'       │      8080       │      8080       │                                                 ''                                                 │  'number'  │
│    2    │    'framework.httpsPort'     │    undefined    │    undefined    │ 'If httpsPort and ssl is defined, then the https server is started additional to the http-server.' │ 'number?'  │
│    3    │    'framework.selfSigned'    │    undefined    │    undefined    │           'If for ssl: true the certificate and key should be automatically generated.'            │ 'boolean?' │
│    4    │ 'framework.keepAliveTimeout' │    undefined    │    undefined    │                                                 ''                                                 │ 'number?'  │
│    5    │       'framework.path'       │       '/'       │       '/'       │                                                 ''                                                 │  'string'  │
│    6    │     'framework.workers'      │        1        │        1        │                                                 ''                                                 │  'number'  │
│    7    │       'framework.ssl'        │      false      │      false      │                                       'Enables HTTPS server'                                       │ 'boolean'  │
│    8    │    'framework.sslOptions'    │    undefined    │    undefined    │                   'Same interface as tls.SecureContextOptions & tls.TlsOptions.'                   │   'any'    │
...
```

## Documentation

### Getting Started
- [Getting Started](./framework/getting-started.md) - Quick start guide and basic concepts
- [Configuration](./framework/configuration.md) - Complete configuration reference
- [Application Server](./framework/application-server.md) - Server lifecycle and management

### Core Features
- [RPC](./framework/rpc.md) - Real-time communication with WebSockets
- [Database](./framework/database.md) - Database integration and migrations
- [Testing](./framework/testing.md) - Comprehensive testing strategies
- [Events](./framework/events.md) - Event system and lifecycle hooks

### Advanced Topics
- [Workers](./framework/workers.md) - Multi-process architecture
- [Broker](./framework/broker.md) - Message broker and inter-process communication
- [Debugging & Profiling](./framework/debugging-profiling.md) - Debug tools and performance analysis
- [Zones](./framework/zones.md) - Request context management
- [Filesystem](./framework/filesystem.md) - File storage abstraction

### Deployment & Production
- [Deployment](./framework/deployment.md) - Production deployment strategies
- [Public Directory](./framework/public.md) - Static file serving
- [API Console](./framework/api-console.md) - Interactive API documentation

### Related Documentation
- [HTTP](./http.md) - HTTP controllers and REST APIs
- [Dependency Injection](./dependency-injection.md) - Service container and providers
- [ORM](./orm.md) - Database modeling and queries
- [App](./app.md) - Application foundation and CLI

## Quick Examples

### HTTP API
```typescript
import { http } from '@deepkit/http';

class UserController {
    @http.GET('/users/:id')
    getUser(@http.param() id: number) {
        return { id, name: `User ${id}` };
    }

    @http.POST('/users')
    createUser(@http.body() userData: CreateUserData) {
        return this.userService.create(userData);
    }
}
```

### RPC Controller
```typescript
import { rpc } from '@deepkit/rpc';

@rpc.controller('users')
class UserRpcController {
    @rpc.action()
    async getUser(id: number): Promise<User> {
        return await this.userService.findById(id);
    }

    @rpc.action()
    getUserUpdates(): Observable<User> {
        return this.userService.getUpdateStream();
    }
}
```

### Service with Dependencies
```typescript
class UserService {
    constructor(
        private database: Database,
        private logger: Logger,
        private eventDispatcher: EventDispatcher
    ) {}

    async createUser(userData: CreateUserData): Promise<User> {
        const user = await this.database.persist(new User(userData));

        await this.eventDispatcher.dispatch(onUserCreated, new UserCreatedEvent(user.id));
        this.logger.log(`User created: ${user.id}`);

        return user;
    }
}
```
