# Dependency Injection

Controller-Klassen werden vom Dependency Injection Container aus `@deepkit/injector` verwaltet. Bei Verwendung des Deepkit Framework haben diese Controller automatisch Zugriff auf die Provider der Module, die den Controller bereitstellen.

Im Deepkit Framework werden Controller im Dependency Injection Scope `rpc` instanziiert, wodurch alle Controller automatisch auf verschiedene Provider aus diesem Scope zugreifen können. Diese zusätzlichen Provider sind `HttpRequest` (optional), `RpcInjectorContext`, `SessionState`, `RpcKernelConnection` und `ConnectionWriter`.

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

Wenn jedoch ein `RpcKernel` manuell instanziiert wird, kann auch ein DI Container übergeben werden. Der RPC-Controller wird dann über diesen DI Container instanziiert. Das ist nützlich, wenn Sie `@deepkit/rpc` in einer Umgebung außerhalb des Deepkit Framework verwenden möchten, wie z. B. Express.js.

```typescript
import { RpcKernel, rpc } from '@deepkit/rpc';
import { InjectorContext } from '@deepkit/injector';
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

const injector = InjectorContext.forProviders([
    Controller,
    { provide: Database, useValue: new Database },
]);
const kernel = new RpcKernel(injector);
kernel.registerController(Controller);
```

Siehe [Dependency Injection](../dependency-injection.md), um mehr zu erfahren.