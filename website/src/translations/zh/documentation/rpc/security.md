# 安全

默认情况下，所有 RPC 函数都可以从任意客户端调用，并且点对点通信功能已启用。要精确控制哪些客户端被允许执行哪些操作，可以重写 `RpcKernelSecurity` 类。

```typescript
import { RpcKernelSecurity, Session, RpcControllerAccess } from '@deepkit/type';

//包含默认实现
class MyKernelSecurity extends RpcKernelSecurity {
    async hasControllerAccess(session: Session, controllerAccess: RpcControllerAccess): Promise<boolean> {
        return true;
    }

    async isAllowedToRegisterAsPeer(session: Session, peerId: string): Promise<boolean> {
        return true;
    }

    async isAllowedToSendToPeer(session: Session, peerId: string): Promise<boolean> {
        return true;
    }

    async authenticate(token: any): Promise<Session> {
        throw new Error('Authentication not implemented');
    }

    transformError(err: Error) {
        return err;
    }
}
```

要使用它，将该提供者传递给 `RpcKernel`：

```typescript
const kernel = new RpcKernel([{provide: RpcKernelSecurity, useClass: MyKernelSecurity, scope: 'rpc'}]);
```

或者，对于 Deepkit 应用，可在应用中使用提供者覆盖 `RpcKernelSecurity` 类：

```typescript
import { App } from '@deepkit/type';
import { RpcKernelSecurity } from '@deepkit/rpc';
import { FrameworkModule } from '@deepkit/framework';

new App({
    controllers: [MyRpcController],
    providers: [
        {provide: RpcKernelSecurity, useClass: MyRpcKernelSecurity, scope: 'rpc'}
    ],
    imports: [new FrameworkModule]
}).run();
```

## 认证 / 会话

默认情况下，`Session` 对象是匿名会话，这意味着客户端尚未认证。当客户端想要进行认证时，会调用 `authenticate` 方法。`authenticate` 方法接收到的 token 来自客户端，且可以是任意值。

一旦客户端设置了 token，认证会在首次调用 RPC 函数时或手动调用 `client.connect()` 时执行。

```typescript
const client = new RpcWebSocketClient('localhost:8081');
client.token.set('123456789');

const controller = client.controller<Controller>('/main');
```

在这种情况下，`RpcKernelSecurity.authenticate` 会收到 token `123456789`，并可相应返回不同的会话。随后，返回的会话会传递给其他所有方法，例如 `hasControllerAccess`。

```typescript
import { Session, RpcKernelSecurity } from '@deepkit/rpc';

class UserSession extends Session {
}

class MyKernelSecurity extends RpcKernelSecurity {
    async hasControllerAccess(session: Session, controllerAccess: RpcControllerAccess): Promise<boolean> {
        if (controllerAccess.controllerClassType instanceof MySecureController) {
            //MySecureController 需要 UserSession
            return session instanceof UserSession;
        }
        return true;
    }

    async authenticate(token: any): Promise<Session> {
        if (token === '123456789') {
            //username 可以是一个 ID 或用户名
            return new UserSession('username', token);
        }
        throw new Error('Authentication failed');
    }
}
```

## 控制器访问

`hasControllerAccess` 方法决定客户端是否被允许执行特定的 RPC 函数。该方法在每次 RPC 函数调用时都会被调用。如果返回 `false`，则拒绝访问，并在客户端抛出错误。

`RpcControllerAccess` 包含有关该 RPC 函数的有用信息：

```typescript
interface RpcControllerAccess {
    controllerName: string;
    controllerClassType: ClassType;
    actionName: string;
    actionGroups: string[];
    actionData: { [name: string]: any };
}
```

可以通过装饰器 `@rpc.action()` 修改分组和附加数据：

```typescript
class Controller {
    @rpc.action().group('secret').data('role', 'admin')
    saveUser(user: User): void {
    }
}

class MyKernelSecurity extends RpcKernelSecurity {
    async hasControllerAccess(session: Session, controllerAccess: RpcControllerAccess): Promise<boolean> {
        if (controllerAccess.actionGroups.includes('secret')) {
            if (session instanceof UserSession) {
                //待办：检查
                return session.username === 'admin';
            }
            return false;
        }
        return true;
    }
}
```