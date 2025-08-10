# セキュリティ

デフォルトでは、すべての RPC 関数は任意のクライアントから呼び出すことができ、ピア・ツー・ピア通信機能が有効になっています。どのクライアントに何を許可するかを厳密に制御するには、`RpcKernelSecurity` クラスをオーバーライドできます。

```typescript
import { RpcKernelSecurity, Session, RpcControllerAccess } from '@deepkit/type';

//デフォルトの実装を含みます
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

これを使用するには、`RpcKernel` にプロバイダを渡します:

```typescript
const kernel = new RpcKernel([{provide: RpcKernelSecurity, useClass: MyKernelSecurity, scope: 'rpc'}]);
```

また、Deepkit アプリの場合は、アプリ内でプロバイダを使って `RpcKernelSecurity` クラスをオーバーライドします:

```typescript
import { App } from '@deepkit/type';
import { RpcKernelSecurity } from '@deepkit/rpc';
import { FrameworkModule } from '@deepkit/framework';

new App({
    controllers: [MyRpcController],
    providers: [
        {provide: RpcKernelSecurity, useClass: MyKernelSecurity, scope: 'rpc'}
    ],
    imports: [new FrameworkModule]
}).run();
```

## 認証 / セッション

デフォルトでは、`Session` オブジェクトは匿名セッションであり、クライアントが認証されていないことを意味します。クライアントが認証したい場合、`authenticate` メソッドが呼び出されます。`authenticate` メソッドが受け取るトークンはクライアントから送られ、任意の値を取り得ます。

クライアントがトークンを設定すると、最初の RPC 関数が呼び出されたとき、または `client.connect()` が手動で実行されたときに認証が行われます。

```typescript
const client = new RpcWebSocketClient('localhost:8081');
client.token.set('123456789');

const controller = client.controller<Controller>('/main');
```

この場合、`RpcKernelSecurity.authenticate` はトークン `123456789` を受け取り、それに応じて別のセッションを返すことができます。返されたセッションは、その後 `hasControllerAccess` のような他のすべてのメソッドに渡されます。

```typescript
import { Session, RpcKernelSecurity } from '@deepkit/rpc';

class UserSession extends Session {
}

class MyKernelSecurity extends RpcKernelSecurity {
    async hasControllerAccess(session: Session, controllerAccess: RpcControllerAccess): Promise<boolean> {
        if (controllerAccess.controllerClassType instanceof MySecureController) {
            //MySecureController には UserSession が必要です
            return session instanceof UserSession;
        }
        return true;
    }

    async authenticate(token: any): Promise<Session> {
        if (token === '123456789') {
            //username は ID でもユーザー名でもかまいません
            return new UserSession('username', token);
        }
        throw new Error('Authentication failed');
    }
}
```

## コントローラーアクセス

`hasControllerAccess` メソッドは、クライアントが特定の RPC 関数を実行することを許可されているかどうかを判定します。このメソッドは、すべての RPC 関数呼び出しに対して呼び出されます。`false` を返した場合、アクセスは拒否され、クライアント側でエラーが送出されます。

`RpcControllerAccess` には RPC 関数に関する有用な情報が含まれます:

```typescript
interface RpcControllerAccess {
    controllerName: string;
    controllerClassType: ClassType;
    actionName: string;
    actionGroups: string[];
    actionData: { [name: string]: any };
}
```

グループと追加データはデコレーター `@rpc.action()` を介して変更できます:

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
                //todo: 確認
                return session.username === 'admin';
            }
            return false;
        }
        return true;
    }
}
```