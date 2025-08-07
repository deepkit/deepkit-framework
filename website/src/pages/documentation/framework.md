# Deepkit Framework

Deepkit Framework is based on [Deepkit App](./app.md) in `@deepkit/app` and provides the `FrameworkModule` module in `@deepkit/framework`, which can be imported in your application.

The `App` abstraction brings:

- CLI commands
- Configuration loading (environment, dotfiles, custom)
- Module system
- Powerful Service Container
- Registry and hooks for controllers, providers, listeners, and more

The `FrameworkModule` module brings additional features:

- Application server
    - HTTP server
    - RPC server
    - Multi-process load balancing
    - SSL
- Debugging CLI commands
- Database Migration configuration/commands
- Debugging/Profiler GUI via `{debug: true}` option
- Interactive API documentation (like Swagger)
- Providers for DatabaseRegistry, ProcessLocking, Broker, Sessions
- Integration Test APIs

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

## Application Server

## File Structure

## Auto-CRUD

## Events

Deepkit framework comes with various event tokens on which event listeners can be registered.

See the [Events](./app/events.md) chapter to learn more about how events work.

### Dispatch Events

Events are sent via the `EventDispatcher` class. In a Deepkit app, this can be provided via dependency injection.

```typescript
import { cli, Command } from '@deepkit/app';
import { EventDispatcher } from '@deepkit/event';

@cli.controller('test')
export class TestCommand implements Command {
    constructor(protected eventDispatcher: EventDispatcher) {
    }

    async execute() {
        this.eventDispatcher.dispatch(UserAdded, new UserEvent({ username: 'Peter' }));
    }
}
```
