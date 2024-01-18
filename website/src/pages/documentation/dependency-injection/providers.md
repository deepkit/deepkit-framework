# Providers

There are several ways to provide dependencies in the Dependency Injection container. The simplest variant is simply the specification of a class. This is also known as short ClassProvider.

```typescript
new App({
    providers: [UserRepository]
});
```

This represents a special provider, since only the class is specified. All other providers must be specified as object literals.

By default, all providers are marked as singletons, so only one instance exists at any given time. To create a new instance each time a provider is deployed, the `transient` option can be used. This will cause classes to be recreated each time or factories to be executed each time.

```typescript
new App({
    providers: [{ provide: UserRepository, transient: true }]
});
```

## ClassProvider

Besides the short ClassProvider there is also the regular ClassProvider, which is an object literal instead of a class.

```typescript
new App({
    providers: [{ provide: UserRepository, useClass: UserRepository }]
});
```

This is equivalent to these two:

```typescript
new App({
    providers: [{ provide: UserRepository }]
});

new App({
    providers: [UserRepository]
});
```

It can be used to exchange a provider with another class.

```typescript
new App({
    providers: [{ provide: UserRepository, useClass: OtherUserRepository }]
});
```

In this example, the `OtherUserRepository` class is now also managed in the DI container and all its dependencies are resolved automatically.

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
import { Inject } from '@deepkit/injector';

class EmailService {
    constructor(public domain: Inject<string, 'domain'>) {}
}
```

The combination of an inject alias and primitive provider tokens can also be used to provide dependencies from packages that do not contain runtime type information.

```typescript
import { Inject } from '@deepkit/injector';
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

## Setup Calls

Setup calls allow to manipulate the result of a provider. This is useful for example to use another dependency injection variant, the method injection.

Setup calls can only be used with the module API or the app API and are registered above the module.

```typescript
class UserRepository  {
    private db?: Database;
    setDatabase(db: Database) {
       this.db = db;
    }
}

const rootModule = new InjectorModule([UserRepository])
     .addImport(lowLevelModule);

rootModule.setupProvider(UserRepository).setDatabase(db);
```

The `setupProvider` method thereby returns a proxy object of UserRepository on which its methods can be called. It should be noted that these method calls are merely placed in a queue and are not executed at this time. Accordingly, no return value is returned.

In addition to method calls, properties can also be set.

```typescript
class UserRepository  {
    db?: Database;
}

const rootModule = new InjectorModule([UserRepository])
     .addImport(lowLevelModule);

rootModule.setupProvider(UserRepository).db = db;
```

This assignment is also simply placed in a queue.

The calls or the assignments in the queue are then executed on the actual result of the provider as soon as this is created. That is with a ClassProvider these are applied to the class instance, as soon as the instance is created, with a FactoryProvider on the result of the Factory, and with a ValueProvider on the Provider.

To reference not only static values, but also other providers, the function `injectorReference` can be used. This function returns a reference to a provider, which is also requested by the DI container when the setup calls are executed.

```typescript
class Database {}

class UserRepository  {
    db?: Database;
}

const rootModule = new InjectorModule([UserRepository, Database])
rootModule.setupProvider(UserRepository).db = injectorReference(Database);
```

*Abstractions/Interfaces*

Setup calls can also be assigned to an interface.

```typescript
rootModule.setupProvider<DatabaseInterface>().logging = logger;
```
