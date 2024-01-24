# Injection

It's called Dependency Injection since a dependency is injected. Injection either happens by the user (manually) or by the DI container (automatically).

## Constructor Injection

In most cases, constructor injection is used. All dependencies are specified as constructor arguments and are automatically injected by the DI container.

```typescript
class MyService {
  constructor(protected database: Database) {}
}
```

Optional dependencies should be marked as such, otherwise an error could be triggered if no provider can be found.

```typescript
class MyService {
  constructor(protected database?: Database) {}
}
```

## Property Injection

An alternative to constructor injection is property injection. This is usually used when the dependency is optional or the constructor is otherwise too full. The properties are automatically assigned once the instance is created (and thus the constructor is executed).

```typescript
import { Inject } from '@deepkit/injector';

class MyService {
  //required
  protected database!: Inject<Database>;

  //or optional
  protected database?: Inject<Database>;
}
```

## Parameter Injection

In various places you can define a callback function, like for example for HTTP Routes or CLI commands. In this case you can define dependencies as parameters.
They will be automatically injected by the DI container.

```typescript
import { Database } from './db';

app.get('/', (database: Database) => {
  //...
});
```

## Injector Context

In case you want to resolve dependencies dynamically, you can inject `InjectorContext` and use it to retrieve dependencies.

```typescript
import { InjectorContext } from '@deepkit/injector';

class MyService {
  constructor(protected context: InjectorContext) {}

  getDatabase(): Database {
    return this.context.get(Database);
  }
}
```

This is especially useful when working with [Dependency Injection Scopes](./scopes.md).
