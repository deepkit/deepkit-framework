# Modules

Deepkit is highly modular and allows you to split your application into several handy modules. Each module has its own dependency injection sub-container (inheriting all parent providers), configuration, commands and much more.
In the chapter [Getting Started](../framework.md) you have already created one module - the root module. `new App` takes almost the same arguments as a module, because it creates the root module for you automatically in the background.

You can skip this chapter if you do not plan to split your application into submodules, or if you do not plan to make a module available as a package to others.

A module can either be defined as class module or as functional module.

```typescript title=Class Module
import { createModuleClass } from '@deepkit/app';

export class MyModule extends createModuleClass({
  //same options as new App({})
  providers: [MyService]
}) {
}
```

```typescript title=Functional Module
import { AppModule } from '@deepkit/app';

export function myModule(options: {} = {}) {
    return (module: AppModule) => {
        module.addProvider(MyService);
    };
}
```

This module can then be imported into your application or other modules.

```typescript
import { MyModule, myModule } from './module.ts'

new App({
    imports: [
        new MyModule(), //import class module
        myModule(), //import functional module
    ]
}).run();
```

You can now add features to this module as you would with `App`. The arguments of `createModule` are the same, except that imports are not available in a module definition.
For functional routes you can use the methods of `AppModule` to configure it dynamically based on your own options.

Add HTTP/RPC/CLI controllers, services, a configuration, event listeners, and various module hooks to make modules more dynamic.

## Controllers

Modules can define controllers that are processed by other modules. For example, if you add a controller with decorators from the `@deepkit/http` package, its `HttpModule` module will pick this up and register the found routes in its router. A single controller may contain several such decorators. It is up to the module author who gives you these decorators how he processes the controllers.

In Deepkit there are three packages that handles such controllers: HTTP, RPC, and CLI. See their respective chapters to learn more. Below is an example of an HTTP controller:

```typescript
import { createModuleClass } from '@deepkit/app';
import { http } from '@deepkit/http';
import { injectable } from '@deepkit/injector';

class MyHttpController {
  @http.GET('/hello)
  hello() {
    return 'Hello world!';
  }
}

export class MyModule extends createModuleClass({
  controllers: [MyHttpController]
}) {
}


//same is possible for App
new App({
  controllers: [MyHttpController]
}).run();
```

## Provider

When you define a provider in the `providers` section of your application, it is accessible throughout your application. For modules, however, these providers are automatically encapsulated in that module's dependency injection subcontainer. You must manually export each provider to make it available to another module or your application.

To learn more about how providers work, see the [Dependency Injection](../dependency-injection.md) chapter.

```typescript
import { createModuleClass } from '@deepkit/app';
import { http } from '@deepkit/http';
import { injectable } from '@deepkit/injector';

export class HelloWorldService {
  helloWorld() {
    return 'Hello there!';
  }
}

class MyHttpController {
  constructor(private helloService: HelloWorldService) {
  }

  @http.GET('/hello)
  hello() {
    return this.helloService.helloWorld();
  }
}

export class MyModule extends createModuleClass({
  controllers: [MyHttpController],
  providers: [HelloWorldService],
}) {
}

export function myModule(options: {} = {}) {
  return (module: AppModule) => {
    module.addController(MyHttpController);
    module.addProvider(HelloWorldService);
  };
}

//same is possible for App
new App({
  controllers: [MyHttpController],
  providers: [HelloWorldService],
}).run();
```

When a user imports this module, he has no access to `HelloWorldService` because it is encapsulated in the sub-dependency injection container of `MyModule`.

## Exports

To make providers available in the importer's module, you can include the provider's token in `exports`. This essentially moves the provider up one level into the dependency injection container of the parent module - the importer.

```typescript
import { createModuleClass } from '@deepkit/app';

export class MyModule extends createModuleClass({
  exports: [HelloWorldService],
}) {
}

export function myModule(options: {} = {}) {
  return (module: AppModule) => {
    module.addExport(HelloWorldService);
  };
}
```

If you have other providers like `FactoryProvider`, `UseClassProvider` etc., you should still use only the class type in the exports.

```typescript
import { createModuleClass } from '@deepkit/app';

export class MyModule extends createModuleClass({
  controllers: [MyHttpController]
  providers: [
    { provide: HelloWorldService, useValue: new HelloWorldService }
  ],
  exports: [HelloWorldService],
}) {
}
```

We can now import that module and use its exported service in our application code.

```typescript
import { App } from '@deepkit/app';
import { cli, Command } from '@deepkit/app';
import { HelloWorldService, MyModule } from './my-module';

@cli.controller('test')
export class TestCommand implements Command {
    constructor(protected helloWorld: HelloWorldService) {
    }

    async execute() {
        this.helloWorld.helloWorld();
    }
}

new App({
    controllers: [TestCommand],
    imports: [
        new MyModule(),
    ]
}).run();
```

Read the [Dependency Injection](../dependency-injection.md) chapter to learn more.


### Configuration schema

A module can have typesafe configuration options. The values of those options can be partially or completely injected to services from that module using simply the class reference or type functions like `Partial<Config, 'url'>`. To define a configuration schema write a class with properties.

```typescript
export class Config {
    title!: string; //required and needs to be provided
    host?: string; //optional

    debug: boolean = false; //default values are supported as well
}
```

```typescript
import { createModuleClass } from '@deepkit/app';
import { Config } from './module.config.ts';

export class MyModule extends createModuleClass({
  config: Config
}) {
}

export function myModule(options: Partial<Config> = {}) {
  return (module: AppModule) => {
    module.setConfigDefinition(Config).configure(options);
  };
}
```

Configuration option values can be provided either by the constructor of your module, with the `.configure()` method, or via configuration loaders (e.g. environment variables loaders).

```typescript
import { MyModule } from './module.ts';

new App({
   imports: [
       new MyModule({title: 'Hello World'}),
       myModule({title: 'Hello World'}),
   ],
}).run();
```

To dynamically change the configuration options of a imported module, you can use the `process` module hook. This is a good place to either redirect configuration options or set up an imported module depending on the current module config, or other module instance information.


```typescript
import { MyModule } from './module.ts';

export class MainModule extends createModuleClass({
}) {
    process() {
        this.getImportedModuleByClass(MyModule).configure({title: 'Changed'});
    }
}

export function myModule(options: Partial<Config> = {}) {
    return (module: AppModule) => {
        module.getImportedModuleByClass(MyModule).configure({title: 'Changed'});
    };
}
```

For the application level, it works slightly differently:

```typescript
new App({
    imports: [new MyModule({title: 'Hello World'}],
})
    .setup((module, config) => {
        module.getImportedModuleByClass(MyModule).configure({title: 'Changed'});
    })
    .run();
```

If the root application module is created from a regular module, it works similarly to regular modules.

```typescript
class AppModule extends createModuleClass({
}) {
    process() {
        this.getImportedModuleByClass(MyModule).configure({title: 'Changed'});
    }
}

App.fromModule(new AppModule()).run();
```

## Module name

All configuration options can also be changed via environment variables. This works only if the module has a name assigned. A module name can be defined via `createModule` and later changed dynamically on the instance creation. The latter pattern is useful if you have imported the same module twice and want to differentiate between them by setting a new name.

```typescript
export class MyModule extends createModuleClass({
  name: 'my'
}) {
}

export function myModule(options: Partial<Config> = {}) {
    return (module: AppModule) => {
        module.name = 'my';
    };
}
```

```typescript
import { MyModule } from './module';

new App({
    imports: [
        new MyModule(), //'my' is the default name
        new MyModule().rename('my2'), //'my2' is now the new name
    ]
}).run();
```

See the chapter [Configuration](./configuration.md) for more information on how to load configuration options from environment variables or .env files.

## Imports

Modules can import other modules to extend their functionality. In `App` you can import other modules in the module definition object via `imports: []`:

```typescript
new App({
    imports: [new Module]
}).run();
```

In regular modules, this is not possible since the module in the object definition object instance would become a global, which is usually not what you want. Instead, modules could be instantiated in module itself via the `imports` property, so that instances of each imported module is created for each new instance of your module.

```typescript
import { createModuleClass } from '@deepkit/app';

export class MyModule extends createModuleClass({}) {
  imports = [new OtherModule()];
}

export function myModule() {
  return (module: AppModule) => {
    module.addImport(new OtherModule());
  };
}
```

You can also import modules dynamically based on the configuration using the `process` hook.

```typescript
import { createModuleClass } from '@deepkit/app';

export class MyModule extends createModuleClass({}) {
  process() {
    if (this.config.xEnabled) {
      this.addImport(new OtherModule({ option: 'value' });
    }
  }
}

export function myModule(option: { xEnabled?: boolean } = {}) {
  return (module: AppModule) => {
    if (option.xEnabled) {
      module.addImport(new OtherModule());
    }
  };
}
```

## Hooks

The service container loads all modules in the order they were imported, starting at the root/application module.

During this process, the service container also executes all registered configuration loaders, calls `setupConfig` callbacks, and then validates the configuration objects of each module.

The whole process of loading the service container is as follows:

1.  For each module `T` (starting at the root)
    1. Execute configuration loaders `ConfigLoader.load(T)`.
    2. Call `T.setupConfig()`.
    3. Validate config of `T`. Abort if invalid.
    4. Call `T.process()`.  
       Here the module can modify itself based on valid configuration options. Add new imports, providers, etc.
    5. Repeat 1. for each imported module of `T`.
3. Find all registered modules.
4. Process each module found `T`.
    1. Register middlewares of `T`.
    2. Register listener of `T` in the event dispatcher.
    3. Call for all found modules from 2. `Module.processController(T, controller)`.
    4. Call for all found modules from 2. `Module.processProvider(T, token, provider)`.
    5. Repeat 3. for each imported module of `T`.
5. Run `T.postProcess()` on all modules.
6. Instantiate the bootstrap class on all modules.
7. The dependency injection container is now built.

To use hooks, you can register the `process`, `processProvider`, `postProcess` methods in your module class.

```typescript
import { createModuleClass, AppModule } from '@deepkit/app';
import { isClass } from '@deepkit/core';
import { ProviderWithScope, Token } from '@deepkit/injector';

export class MyModule extends createModuleClass({}) {
  imports = [new FrameworkModule()];

  //executed first
  process() {
    //this.config contains the fully validated config object.
    if (this.config.environment === 'development') {
      this.getImportedModuleByClass(FrameworkModule).configure({ debug: true });
    }
    this.addModule(new AnotherModule);
    this.addProvider(Service);

    //calls additional setup methods. 
    //In this case call 'method1' with given arguments when 
    //Service is instantiated by the dependency injection container.
    this.configureProvider<Service>(v => v.method1(this.config.value));
  }

  //executed for each found provider in all modules
  processController(module: AppModule<any>, controller: ClassType) {
    //HttpModule for example checks for each controller whether
    //a @http decorator was used, and if so extracts all route
    //information and puts them the router.
  }

  //executed for each found provider in all modules
  processProvider(module: AppModule<any>, token: Token, provider: ProviderWithScope) {
    //FrameworkModule for example looks for provided tokens that extend from deepkit/orm Database
    //and automatically registers them in a DatabaseRegistry so they can be used in the migration CLI commands
    //and Framework Debugger.
  }

  //executed when all modules have been processed.
  //Last chance to setup providers via module.configureProvider based on
  //information processed in process/processProvider. 
  postProcess() {

  }
}
```

## Stateful Modules

Since each module is explicitly instantiated with `new Module`, the module can have a state. This state can be injected into the dependency injection container so it is available for services.

As an example, consider the HttpModule use-case. It checks each registered controller in the whole application to have certain @http decorators, and if so, puts the controller in a registry. This registry is injected to the Router, which, once instantiated, extracts all route information of those controllers and register them.

```typescript
class Registry {
    protected controllers: { module: AppModule<any>, classType: ClassType }[] = [];
        
    register(module: AppModule<any>, controller: ClassType) {
        this.controllers.push({ module, classType: controller });
    }
        
    get(classType: ClassType) {
        const controller = this.controllers.find(v => v.classType === classType);
        if (!controller) throw new Error('Controller unknown');
        return controller;
    }
}
        
class Router {
    constructor(
        protected injectorContext: InjectorContext,
        protected registry: Registry
    ) {
    }
        
    getController(classType: ClassType) {
        //find classType and module for given controller classType
        const controller = this.registry.get(classType);
        
        //here the controller will be instantiated. If it was already
        //instantiated, the old instanced will be returned (if the provider was not transient: true)
        return injector.get(controller.classType, controller.module);
    }
}
        
class HttpModule extends createModuleClass({
    providers: [Router],
    exports: [Router],
}) {
    protected registry = new Registry;
        
    process() {
        this.addProvider({ provide: Registry, useValue: this.registry });
    }
        
    processController(module: AppModule<any>, controller: ClassType) {
        //controllers need to be put into the module's providers by the controller consumer
        if (!module.isProvided(controller)) module.addProvider(controller);
        this.registry.register(module, controller);
    }
}
        
class MyController {}
        
const app = new App({
    controllers: [MyController],
    imports: [new HttpModule()]
});
        
const myController = app.get(Router).getController(MyController);
```

## For root

The `root` property allows you to move the dependency injection container of a module into the root application's container. This makes every service available from the module automatically available in the root application itself. It basically moves each provider (controller, event listener, provider) into the root container. This could lead to dependency clashes, so should only be used for a module that has really only globals. You should prefer exporting each provider manually instead.

If you build a library that can be used by many modules, you should avoid using `root`, as it could clash with provider tokens from other libraries. For example, if this library module imports a `foo` module that defines a service, and you reconfigure some services to your need, and the user's application imports the same `foo` module, the user receives your reconfigured services. For many simpler use cases this might be fine though.

```typescript
import { createModuleClass } from '@deepkit/app';

export class MyModule extends createModuleClass({}) {
  root = true;
}
```

You can also change the `root` property of a third-party module, by using `forRoot()`.

```typescript
new App({
    imports: [new ThirdPartyModule().forRoot()],
}).run();
```

## Testing Modules

Test modules in isolation or as part of larger applications:

```typescript
import { createTestingApp } from '@deepkit/framework';

test('DatabaseModule provides DatabaseService', () => {
    const testing = createTestingApp({
        imports: [new DatabaseModule({ host: 'localhost' })]
    });

    const dbService = testing.app.get(DatabaseService);
    expect(dbService).toBeInstanceOf(DatabaseService);
});

test('UserModule integrates with DatabaseModule', () => {
    const testing = createTestingApp({
        imports: [new UserModule()]
    });

    const userService = testing.app.get(UserService);
    const dbService = testing.app.get(DatabaseService);

    expect(userService).toBeInstanceOf(UserService);
    expect(dbService).toBeInstanceOf(DatabaseService);
});

test('Module configuration validation', () => {
    expect(() => {
        new DatabaseModule({ host: '' }); // Invalid empty host
    }).toThrow('Host cannot be empty');
});
```

## Module Composition Patterns

### Plugin Architecture

Create a plugin system using modules:

```typescript
interface Plugin {
    name: string;
    version: string;
    initialize(): void;
}

class PluginModule extends createModuleClass({}) {
    constructor(private plugin: Plugin) {
        super();
    }

    process() {
        this.addProvider({ provide: this.plugin.name, useValue: this.plugin });
        this.plugin.initialize();
    }
}

// Usage
const app = new App({
    imports: [
        new PluginModule(new EmailPlugin()),
        new PluginModule(new CachePlugin()),
        new PluginModule(new MetricsPlugin())
    ]
});
```

### Feature Flags

Use modules to implement feature flags:

```typescript
class FeatureConfig {
    enableNewUI: boolean = false;
    enableBetaFeatures: boolean = false;
}

class FeatureModule extends createModuleClass({
    config: FeatureConfig
}) {
    process() {
        if (this.config.enableNewUI) {
            this.addProvider(NewUIService);
            this.addController(NewUIController);
        }

        if (this.config.enableBetaFeatures) {
            this.addProvider(BetaFeatureService);
        }
    }
}
```

### Environment-Specific Modules

Load different modules based on environment:

```typescript
class AppModule extends createModuleClass({}) {
    process() {
        const environment = process.env.NODE_ENV || 'development';

        // Always load core modules
        this.addImport(new DatabaseModule());
        this.addImport(new UserModule());

        // Environment-specific modules
        if (environment === 'development') {
            this.addImport(new DevToolsModule());
            this.addImport(new MockServicesModule());
        } else if (environment === 'production') {
            this.addImport(new MonitoringModule());
            this.addImport(new CacheModule());
        }

        if (environment === 'test') {
            this.addImport(new TestUtilitiesModule());
        }
    }
}
```

## Advanced Module Hooks

### Dynamic Provider Registration

Register providers dynamically based on runtime conditions:

```typescript
class DynamicModule extends createModuleClass({}) {
    processProvider(module: AppModule<any>, token: Token, provider: ProviderWithScope) {
        // Automatically register all services that implement a specific interface
        if (isClass(token) && implementsInterface(token, 'EventHandler')) {
            this.eventHandlers.push(token);
        }

        // Add logging to all services in development
        if (process.env.NODE_ENV === 'development' && isClass(token)) {
            this.wrapWithLogging(provider);
        }
    }

    postProcess() {
        // Register all found event handlers
        for (const handler of this.eventHandlers) {
            this.addProvider(handler);
        }
    }
}
```

### Cross-Module Communication

Enable modules to communicate with each other:

```typescript
class ModuleRegistry {
    private modules = new Map<string, AppModule<any>>();

    register(name: string, module: AppModule<any>) {
        this.modules.set(name, module);
    }

    get(name: string): AppModule<any> | undefined {
        return this.modules.get(name);
    }
}

class CommunicatingModule extends createModuleClass({
    name: 'communicating'
}) {
    process() {
        // Register self in registry
        const registry = this.getImportedModuleByClass(RegistryModule)
            .get(ModuleRegistry);
        registry.register(this.name, this);

        // Find and configure other modules
        const userModule = registry.get('user');
        if (userModule) {
            userModule.configure({ enableNotifications: true });
        }
    }
}
```

## Module Best Practices

### 1. Single Responsibility

Each module should have a clear, single responsibility:

```typescript
// Good: Focused on user management
class UserModule extends createModuleClass({
    providers: [UserService, UserRepository, UserValidator],
    controllers: [UserController],
    exports: [UserService]
}) {}

// Bad: Too many responsibilities
class EverythingModule extends createModuleClass({
    providers: [UserService, EmailService, PaymentService, LoggingService],
    // ... too many unrelated services
}) {}
```

### 2. Clear Dependencies

Make module dependencies explicit:

```typescript
class UserModule extends createModuleClass({
    imports: [
        new DatabaseModule(), // Explicit dependency
        new EmailModule()     // Another explicit dependency
    ],
    providers: [UserService]
}) {
    process() {
        // Validate dependencies are available
        if (!this.getImportedModuleByClass(DatabaseModule)) {
            throw new Error('UserModule requires DatabaseModule');
        }
    }
}
```

### 3. Configuration Validation

Validate module configuration early:

```typescript
class ApiConfig {
    baseUrl!: string;
    timeout: number = 5000;
    retries: number = 3;
}

class ApiModule extends createModuleClass({
    config: ApiConfig
}) {
    process() {
        // Validate configuration
        if (!this.config.baseUrl) {
            throw new Error('API base URL is required');
        }

        if (!this.config.baseUrl.startsWith('http')) {
            throw new Error('API base URL must be a valid HTTP URL');
        }

        if (this.config.timeout < 1000) {
            console.warn('API timeout is very low, consider increasing it');
        }
    }
}
```

### 4. Graceful Degradation

Handle missing optional dependencies gracefully:

```typescript
class NotificationModule extends createModuleClass({
    providers: [NotificationService]
}) {
    process() {
        // Optional email integration
        try {
            const emailModule = this.getImportedModuleByClass(EmailModule);
            this.configureProvider<NotificationService>(service => {
                service.setEmailService(emailModule.get(EmailService));
            });
        } catch {
            console.log('Email module not available, notifications will use console only');
        }
    }
}
```

## Injector Context

The InjectorContext is the dependency injection container. It allows you to request/instantiate services from your own or other modules. This is necessary if for example you have stored a controller in `processControllers` and want to correctly instantiate them.

```typescript
class ControllerRegistry {
    private controllers = new Map<string, {module: AppModule<any>, controller: ClassType}>();

    register(name: string, module: AppModule<any>, controller: ClassType) {
        this.controllers.set(name, { module, controller });
    }

    instantiate(name: string, injectorContext: InjectorContext) {
        const entry = this.controllers.get(name);
        if (!entry) throw new Error(`Controller ${name} not found`);

        // Get the correct injector for the module
        const injector = injectorContext.getInjector(entry.module);
        return injector.get(entry.controller);
    }
}
```
