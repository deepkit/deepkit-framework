# Dependency Injection

Controller classes are managed by the Dependency Injection Container from `@deepkit/injector`. When using the Deepkit Framework, these controllers automatically have access to the providers of the modules that provide the controller.

In the Deepkit Framework, controllers are instantiated in the Dependency Injection Scope `rpc`, allowing all controllers to automatically access various providers from this scope. These additional providers are `HttpRequest` (optional), `RpcInjectorContext`, `SessionState`, `RpcKernelConnection`, and `ConnectionWriter`.

```typescript
import { RpcKernel, rpc } from '@deepkit/rpc';
import { App } from '@deepkit/app';
import { Database, User } from './database';

@rpc.controller('/main')
class Controller {
    constructor(private database: Database) {
    }

    @rpc.action()
    async getUser(id: number): Promise<User> {
        return await this.database.query(User).filter({ id }).findOne();
    }
}

new App({
    providers: [{ provide: Database, useValue: new Database }]
    controllers: [Controller],
}).run();
```

However, when an `RpcKernel` is manually instantiated, a DI Container can also be passed. The RPC Controller will then be instantiated through this DI Container. This is useful if you want to use `@deepkit/rpc` in a non-Deepkit Framework environment, like Express.js.

```typescript
import { InjectorContext } from '@deepkit/injector';
import { RpcKernel, rpc } from '@deepkit/rpc';

import { Database, User } from './database';

@rpc.controller('/main')
class Controller {
  constructor(private database: Database) {}

  @rpc.action()
  async getUser(id: number): Promise<User> {
    return await this.database.query(User).filter({ id }).findOne();
  }
}

const injector = InjectorContext.forProviders([Controller, { provide: Database, useValue: new Database() }]);
const kernel = new RpcKernel(injector);
kernel.registerController(Controller);
```

See [Dependency Injection](xref:dependency-injection.adoc) to learn more.
