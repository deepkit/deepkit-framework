# Providers

Providers define how dependencies are created and managed by the dependency injection container. They specify what should be injected when a particular type or token is requested. Deepkit supports several provider types, each suited for different use cases.

## Provider Lifecycle

**Singleton (Default)**: By default, all providers are singletons - only one instance exists during the application lifetime:

```typescript
new App({
    providers: [UserRepository] // Singleton by default
});

// Both calls return the same instance
const repo1 = injector.get(UserRepository);
const repo2 = injector.get(UserRepository);
console.log(repo1 === repo2); // true
```

**Transient**: Create a new instance every time the provider is requested:

```typescript
new App({
    providers: [
        { provide: UserRepository, transient: true }
    ]
});

// Each call creates a new instance
const repo1 = injector.get(UserRepository);
const repo2 = injector.get(UserRepository);
console.log(repo1 === repo2); // false
```

**When to use Transient:**
- Stateful services that shouldn't be shared
- Services that are expensive to keep in memory
- Services that need fresh state for each use

## ClassProvider

ClassProvider is the most common provider type. It tells the injector to create an instance of a class when the provider is requested.

### Short Form (Recommended)

The simplest way to register a class:

```typescript
new App({
    providers: [UserRepository] // Short form
});
```

### Explicit Form

The explicit object form provides more control:

```typescript
new App({
    providers: [
        { provide: UserRepository, useClass: UserRepository }
    ]
});
```

These are equivalent:

```typescript
// All three are identical
new App({ providers: [UserRepository] });
new App({ providers: [{ provide: UserRepository }] });
new App({ providers: [{ provide: UserRepository, useClass: UserRepository }] });
```

### Class Substitution

Use explicit form to substitute one class for another:

```typescript
interface UserRepository {
    findUser(id: string): User | null;
}

class DatabaseUserRepository implements UserRepository {
    constructor(private db: Database) {}
    findUser(id: string) { /* database implementation */ }
}

class MockUserRepository implements UserRepository {
    findUser(id: string) { /* mock implementation */ }
}

// Production
new App({
    providers: [
        { provide: UserRepository, useClass: DatabaseUserRepository }
    ]
});

// Testing
new App({
    providers: [
        { provide: UserRepository, useClass: MockUserRepository }
    ]
});
```

The substitute class (`DatabaseUserRepository` or `MockUserRepository`) is fully managed by the DI container with automatic dependency resolution.

## ValueProvider

Static values can be provided with this provider.

```typescript
new App({
    providers: [{ provide: OtherUserRepository, useValue: new OtherUserRepository() }]
});
```

Since not only class instances can be provided as dependencies, any value can be specified as `useValue`. A symbol or a primitive (string, number, boolean) could also be used as a provider token.

```typescript
new App({
    providers: [{ provide: 'domain', useValue: 'localhost' }]
});
```

Primitive provider tokens must be declared with the Inject type as a dependency.

```typescript
import { Inject } from '@deepkit/core';

class EmailService {
    constructor(public domain: Inject<string, 'domain'>) {}
}
```

The combination of an inject alias and primitive provider tokens can also be used to provide dependencies from packages that do not contain runtime type information.

```typescript
import { Inject } from '@deepkit/core';
import { Stripe } from 'stripe';

export type StripeService = Inject<Stripe, '_stripe'>;

new App({
    providers: [{ provide: '_stripe', useValue: new Stripe }]
});
```

And then declared on the user side as follows:

```typescript
class PaymentService {
    constructor(public stripe: StripeService) {}
}
```

## ExistingProvider

A forwarding to an already defined provider can be defined.

```typescript
new App({
    providers: [
        {provide: OtherUserRepository, useValue: new OtherUserRepository()},
        {provide: UserRepository, useExisting: OtherUserRepository}
    ]
});
```

## FactoryProvider

A function can be used to provide a value for the provider. This function can also contain parameters, which in turn are provided by the DI container. Thus, other dependencies or configuration options are accessible.

```typescript
new App({
    providers: [
        {provide: OtherUserRepository, useFactory: () => {
            return new OtherUserRepository()
        }},
    ]
});

new App({
    providers: [
        {provide: OtherUserRepository, useFactory: (domain: RootConfiguration['domain']) => {
            return new OtherUserRepository(domain);
        }},
    ]
});

new App({
    providers: [
        Database,
        {provide: OtherUserRepository, useFactory: (database: Database) => {
            return new OtherUserRepository(database);
        }},
    ]
});
```

## InterfaceProvider

In addition to classes and primitives, abstractions (interfaces) can also be provided. This is done via the function `provide` and is particularly useful if the value to be provided does not contain any type information.

```typescript
import { provide } from '@deepkit/injector';

interface Connection {
    write(data: Uint16Array): void;
}

class Server {
   constructor (public connection: Connection) {}
}

class MyConnection {
    write(data: Uint16Array): void {}
}

new App({
    providers: [
        Server,
        provide<Connection>(MyConnection)
    ]
});
```

If multiple providers have implemented the Connection interface, the last provider is used.

As argument for provide() all other providers are possible.

```typescript
const myConnection = {write: (data: any) => undefined};

new App({
    providers: [
        provide<Connection>({ useValue: myConnection })
    ]
});

new App({
    providers: [
        provide<Connection>({ useFactory: () => myConnection })
    ]
});
```

## Asynchronous Providers

The design of `@deepkit/injector` precludes the use of asynchronous providers with an asynchronous Dependency Injection container. This is because requesting providers would also need to be asynchronous, necessitating the entire application to operate at the highest level asynchronously.

To initialize something asynchronously, this initialization should be moved to the application server bootstrap,  because there the events can be asynchronous. Alternatively, an initialization can be triggered manually.

## Configure Providers

Configuration callbacks allow to manipulate the result of a provider. This is useful for example to use another dependency injection variant, the method injection.

They can only be used with the module API or the app API and are registered above the module.

```typescript
class UserRepository  {
    private db?: Database;
    setDatabase(db: Database) {
       this.db = db;
    }
}

const rootModule = new InjectorModule([UserRepository])
     .addImport(lowLevelModule);

rootModule.configureProvider<UserRepository>(v => {
  v.setDatabase(db);
});
```

The `configureProvider` receives in the callback as the first parameter `v` the UserRepository instance on which its methods can be called.

In addition to method calls, properties can also be set.

```typescript
class UserRepository  {
    db?: Database;
}

const rootModule = new InjectorModule([UserRepository])
     .addImport(lowLevelModule);

rootModule.configureProvider<UserRepository>(v => {
  v.db = new Database();
});
```

All the callbacks are placed into a queue and executed in the order they were defined.

The calls in the queue are then executed on the actual result of the provider as soon as the provider is created. That is with a ClassProvider these are applied to the class instance, as soon as the instance is created, with a FactoryProvider on the result of the Factory, and with a ValueProvider on the Provider.

To reference not only static values, but also other providers, arbitary dependencies can be injected into the callback, by just defining them as arguments. Make sure these dependencies are known in the provider scope.

```typescript
class Database {}

class UserRepository  {
    db?: Database;
}

const rootModule = new InjectorModule([UserRepository, Database])
rootModule.configureProvider<UserRepository>((v, db: Database) => {
  v.db = db;
});
```

## TagProvider

TagProviders allow you to group related services together and inject them as a collection. This is useful for plugin systems, event handlers, middleware, or any scenario where you need to collect multiple implementations of a common interface.

```typescript
import { Tag } from '@deepkit/injector';

// Define what services should implement
interface EventHandler {
    handle(event: any): void;
}

// Create a tag class
class EventHandlerTag extends Tag<EventHandler> {}

// Implement various handlers
class UserEventHandler implements EventHandler {
    handle(event: any) {
        console.log('Handling user event:', event);
    }
}

class EmailEventHandler implements EventHandler {
    handle(event: any) {
        console.log('Sending email for event:', event);
    }
}

class LogEventHandler implements EventHandler {
    handle(event: any) {
        console.log('Logging event:', event);
    }
}

// Event manager that uses all handlers
class EventManager {
    constructor(private handlers: EventHandlerTag) {}

    dispatch(event: any) {
        // handlers.services contains all tagged services
        for (const handler of this.handlers.services) {
            handler.handle(event);
        }
    }
}

// Register tagged providers
new App({
    providers: [
        EventManager,
        EventHandlerTag.provide(UserEventHandler),
        EventHandlerTag.provide(EmailEventHandler),
        EventHandlerTag.provide(LogEventHandler),
    ]
});
```

**Advanced Tag Usage:**

```typescript
// Tags can be used with different provider types
class PluginTag extends Tag<Plugin> {}

new App({
    providers: [
        // Class provider
        PluginTag.provide(DatabasePlugin),

        // Factory provider
        PluginTag.provide({
            useFactory: (config: AppConfig) => new CachePlugin(config.cache)
        }),

        // Value provider
        PluginTag.provide({
            useValue: new StaticPlugin()
        }),
    ]
});
```

**Use Cases for Tags:**
- Plugin systems
- Middleware collections
- Event handler registration
- Strategy pattern implementations
- Decorator pattern collections

## Nominal types

Note that the passed type to `configureProvider`, like in the last example `UserRepository`, is not resolved using structural type checking, but by nominal types. This means for example two classes/interfaces with the same structure but different identity are not compatible. The same is true for `get<T>` calls or when a dependency is resolved. 

This differentiates to the way TypeScript type checking works, which is based on structural type checking. This design decision was made to avoid accidental misconfigurations (e.g. requesting an empty class, which is structurally compatible to any class) and to make the code more robust.


In the following example the `User1` and `User2` classes are structurally compatible, but not nominally. This means requesting `User1` will not resolve `User2` and vice versa.

```typescript

class User1 {
    name: string = '';
}

class User2 {
    name: string = '';
}

new App({
    providers: [User1, User2]
});
```

Extending classes and implementing interfaces establishes a nominal relationship.

```typescript
class UserBase {
    name: string = '';
}

class User extends UserBase {
}

const app = new App({
    providers: [User2]
});

app.get(UserBase); //returns User
```

```typescript
interface UserInterface {
    name: string;
}

class User implements UserInterface {
    name: string = '';
}

const app = new App({
    providers: [User]
});

app.get<UserInterface>(); //returns User
```
