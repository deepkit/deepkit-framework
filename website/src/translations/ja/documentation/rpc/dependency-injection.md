# 依存性注入

Controller クラスは `@deepkit/injector` の依存性注入コンテナによって管理されます。Deepkit Framework を使用する場合、これらのコントローラは、そのコントローラを提供するモジュールのプロバイダーに自動的にアクセスできます。

Deepkit Framework では、コントローラは依存性注入スコープ `rpc` でインスタンス化され、すべてのコントローラはこのスコープのさまざまなプロバイダーに自動的にアクセスできます。これらの追加のプロバイダーは `HttpRequest`（任意）、`RpcInjectorContext`、`SessionState`、`RpcKernelConnection`、`ConnectionWriter` です。

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

ただし、`RpcKernel` を手動でインスタンス化する場合、DI コンテナを渡すこともできます。すると RPC コントローラはこの DI コンテナを通じてインスタンス化されます。これは、Express.js のような Deepkit Framework 以外の環境で `@deepkit/rpc` を使用したい場合に有用です。

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

詳しくは [依存性注入](../dependency-injection.md) を参照してください。