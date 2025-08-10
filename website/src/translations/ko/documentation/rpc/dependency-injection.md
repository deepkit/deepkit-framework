# Dependency Injection

Controller 클래스는 `@deepkit/injector`의 Dependency Injection Container에 의해 관리됩니다. Deepkit Framework를 사용할 때, 이들 Controller는 해당 Controller를 제공하는 모듈의 providers에 자동으로 접근할 수 있습니다.

Deepkit Framework에서는 Controller가 Dependency Injection Scope `rpc`에서 인스턴스화되며, 이로 인해 모든 Controller는 이 스코프의 다양한 providers에 자동으로 접근할 수 있습니다. 추가로 제공되는 providers는 `HttpRequest`(옵션), `RpcInjectorContext`, `SessionState`, `RpcKernelConnection`, `ConnectionWriter`입니다.

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

그러나 `RpcKernel`을 수동으로 인스턴스화할 때는 DI Container를 함께 전달할 수도 있습니다. 그러면 RPC Controller는 이 DI Container를 통해 인스턴스화됩니다. 이는 Express.js와 같은 Deepkit Framework가 아닌 환경에서 `@deepkit/rpc`를 사용하려는 경우에 유용합니다.

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

자세한 내용은 [Dependency Injection](../dependency-injection.md)을 참조하세요.