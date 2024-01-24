# Dependency Injection

The router functions as well as the controller classes and controller methods can define arbitrary dependencies, which are resolved by the dependency injection container. For example, it is possible to conveniently get to a database abstraction or logger.

For example, if a database has been provided as a provider, it can be injected:

```typescript
class Database {
  //...
}

const app = new App({
  providers: [Database],
});
```

_Functional API:_

```typescript
router.get('/user/:id', async (id: number, database: Database) => {
  return await database.query(User).filter({ id }).findOne();
});
```

_Controller API:_

```typescript
class UserController {
    constructor(private database: Database) {}

    @http.GET('/user/:id')
    async userDetail(id: number) {
        return await this.database.query(User).filter({id}).findOne();
    }
}

//alternatively directly in the method
class UserController {
    @http.GET('/user/:id')
    async userDetail(id: number, database: Database) {
        return await database.query(User).filter({id}).findOne();
    }
}
```

See [Dependency Injection](dependency-injection) to learn more.

## Scope

All HTTP controllers and functional routes are managed within the `http` dependency injection scope. HTTP controllers are instantiated accordingly for each HTTP request. This also means that both can access providers registered for the `http` scope. So additionally `HttpRequest` and `HttpResponse` from `@deepkit/http` are usable as dependencies. If deepkit framework is used, `SessionHandler` from `@deepkit/framework` is also available.

```typescript
import { HttpResponse } from '@deepkit/http';

router.get('/user/:id', (id: number, request: HttpRequest) => {});

router.get('/', (response: HttpResponse) => {
  response.end('Hello');
});
```

It can be useful to place providers in the `http` scope, for example to instantiate services for each HTTP request. Once the HTTP request has been processed, the `http` scoped DI container is deleted, thus cleaning up all its provider instances from the garbage collector (GC).

See [Dependency Injection Scopes](dependency-injection.md#di-scopes) to learn how to place providers in the `http` scope.
