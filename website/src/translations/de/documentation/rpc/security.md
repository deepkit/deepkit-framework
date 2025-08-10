# Sicherheit

Standardmäßig können alle RPC-Funktionen von jedem Client aufgerufen werden, und die Peer-to-Peer-Kommunikation ist aktiviert. Um präzise zu steuern, welcher Client was darf, können Sie die Klasse `RpcKernelSecurity` überschreiben.

```typescript
import { RpcKernelSecurity, Session, RpcControllerAccess } from '@deepkit/type';

//enthält Standardimplementierungen
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

Um dies zu verwenden, übergeben Sie den Provider an den `RpcKernel`:

```typescript
const kernel = new RpcKernel([{provide: RpcKernelSecurity, useClass: MyKernelSecurity, scope: 'rpc'}]);
```

Oder überschreiben Sie im Fall einer Deepkit-App die Klasse `RpcKernelSecurity` mit einem Provider in der App:

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

## Authentifizierung / Session

Standardmäßig ist das `Session`-Objekt eine anonyme Session, d. h. der Client hat sich nicht authentifiziert. Wenn der Client sich authentifizieren möchte, wird die Methode `authenticate` aufgerufen. Das von der Methode `authenticate` empfangene Token kommt vom Client und kann jeden beliebigen Wert haben.

Sobald der Client ein Token setzt, wird die Authentifizierung ausgeführt, wenn die erste RPC-Funktion aufgerufen wird oder wenn `client.connect()` manuell aufgerufen wird.


```typescript
const client = new RpcWebSocketClient('localhost:8081');
client.token.set('123456789');

const controller = client.controller<Controller>('/main');
```

In diesem Fall erhält `RpcKernelSecurity.authenticate` das Token `123456789` und kann entsprechend eine andere Session zurückgeben. Die zurückgegebene Session wird dann an alle anderen Methoden wie `hasControllerAccess` weitergegeben.

```typescript
import { Session, RpcKernelSecurity } from '@deepkit/rpc';

class UserSession extends Session {
}

class MyKernelSecurity extends RpcKernelSecurity {
    async hasControllerAccess(session: Session, controllerAccess: RpcControllerAccess): Promise<boolean> {
        if (controllerAccess.controllerClassType instanceof MySecureController) {
            //MySecureController erfordert UserSession
            return session instanceof UserSession;
        }
        return true;
    }

    async authenticate(token: any): Promise<Session> {
        if (token === '123456789') {
            //Benutzername kann eine ID oder ein Benutzername sein
            return new UserSession('username', token);
        }
        throw new Error('Authentication failed');
    }
}
```

## Controller-Zugriff

Die Methode `hasControllerAccess` bestimmt, ob ein Client eine bestimmte RPC-Funktion ausführen darf. Diese Methode wird bei jedem Aufruf einer RPC-Funktion ausgeführt. Gibt sie `false` zurück, wird der Zugriff verweigert und beim Client ein Fehler ausgelöst.

Das `RpcControllerAccess` enthält wertvolle Informationen über die RPC-Funktion:

```typescript
interface RpcControllerAccess {
    controllerName: string;
    controllerClassType: ClassType;
    actionName: string;
    actionGroups: string[];
    actionData: { [name: string]: any };
}
```

Gruppen und zusätzliche Daten können über den Decorator `@rpc.action()` geändert werden:

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
                //todo: prüfen
                return session.username === 'admin';
            }
            return false;
        }
        return true;
    }
}
```