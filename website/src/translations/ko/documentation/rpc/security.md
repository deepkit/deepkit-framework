# 보안

기본적으로 모든 RPC Function은 어떤 클라이언트든 호출할 수 있으며, peer-to-peer 통신 기능이 활성화되어 있습니다. 어떤 클라이언트가 무엇을 할 수 있는지 세밀하게 제어하려면 `RpcKernelSecurity` Class를 override 할 수 있습니다.

```typescript
import { RpcKernelSecurity, Session, RpcControllerAccess } from '@deepkit/type';

//기본 구현이 포함되어 있습니다
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

이를 사용하려면 `RpcKernel`에 provider를 전달하세요:

```typescript
const kernel = new RpcKernel([{provide: RpcKernelSecurity, useClass: MyKernelSecurity, scope: 'rpc'}]);
```

또는 Deepkit app의 경우, app에서 provider로 `RpcKernelSecurity` Class를 override 합니다:

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

## 인증 / 세션

기본적으로 `Session` 객체는 익명 세션이며, 이는 클라이언트가 인증되지 않았음을 의미합니다. 클라이언트가 인증을 원할 때 `authenticate` Method가 호출됩니다. `authenticate` Method가 받는 token은 클라이언트로부터 오며 어떤 값이든 될 수 있습니다.

클라이언트가 token을 설정하면, 첫 번째 RPC Function이 호출될 때 또는 `client.connect()`가 수동으로 호출될 때 인증이 수행됩니다.


```typescript
const client = new RpcWebSocketClient('localhost:8081');
client.token.set('123456789');

const controller = client.controller<Controller>('/main');
```

이 경우 `RpcKernelSecurity.authenticate`는 token `123456789`를 받아 그에 따라 다른 세션을 반환할 수 있습니다. 반환된 세션은 `hasControllerAccess`와 같은 다른 모든 Method로 전달됩니다.

```typescript
import { Session, RpcKernelSecurity } from '@deepkit/rpc';

class UserSession extends Session {
}

class MyKernelSecurity extends RpcKernelSecurity {
    async hasControllerAccess(session: Session, controllerAccess: RpcControllerAccess): Promise<boolean> {
        if (controllerAccess.controllerClassType instanceof MySecureController) {
            //MySecureController는 UserSession이 필요합니다
            return session instanceof UserSession;
        }
        return true;
    }

    async authenticate(token: any): Promise<Session> {
        if (token === '123456789') {
            //username은 ID 또는 사용자명일 수 있습니다
            return new UserSession('username', token);
        }
        throw new Error('Authentication failed');
    }
}
```

## 컨트롤러 접근

`hasControllerAccess` Method는 클라이언트가 특정 RPC Function을 실행할 수 있는지를 결정합니다. 이 Method는 모든 RPC Function 호출마다 실행됩니다. `false`를 반환하면 접근이 거부되고, 클라이언트에서 Error가 발생합니다.

`RpcControllerAccess`에는 해당 RPC Function에 대한 유용한 정보가 포함됩니다:

```typescript
interface RpcControllerAccess {
    controllerName: string;
    controllerClassType: ClassType;
    actionName: string;
    actionGroups: string[];
    actionData: { [name: string]: any };
}
```

Group과 추가 data는 decorator `@rpc.action()`을 통해 변경할 수 있습니다:

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
                //todo: 확인
                return session.username === 'admin';
            }
            return false;
        }
        return true;
    }
}
```