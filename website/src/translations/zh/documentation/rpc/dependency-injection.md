# 依赖注入

控制器类由 `@deepkit/injector` 的依赖注入容器管理。在使用 Deepkit 框架时，这些控制器会自动访问声明该控制器的模块中的提供者。

在 Deepkit 框架中，控制器在依赖注入作用域 `rpc` 中被实例化，使所有控制器都能自动访问该作用域中的各种提供者。这些额外的提供者包括 `HttpRequest`（可选）、`RpcInjectorContext`、`SessionState`、`RpcKernelConnection` 和 `ConnectionWriter`。

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

然而，当手动实例化 `RpcKernel` 时，也可以传入一个 DI 容器。随后 RPC 控制器会通过该 DI 容器实例化。如果你希望在非 Deepkit 框架的环境（例如 Express.js）中使用 `@deepkit/rpc`，这将非常有用。

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

参见[依赖注入](../dependency-injection.md)以了解更多。
