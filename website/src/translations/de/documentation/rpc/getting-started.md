# Erste Schritte

Um Deepkit RPC zu verwenden, muss `@deepkit/type` korrekt installiert sein, da es auf Runtime Types basiert. Siehe [Installation von Runtime Types](../runtime-types.md).

Sobald dies erfolgreich erledigt ist, kann `@deepkit/rpc` oder das Deepkit Framework, das die Bibliothek bereits unter der Haube verwendet, installiert werden.

```sh
npm install @deepkit/rpc
```

Beachte, dass Controller Classes in `@deepkit/rpc` auf TypeScript Decorators basieren und dieses Feature mit experimentalDecorators aktiviert sein muss.

Das Package `@deepkit/rpc` muss sowohl auf dem Server als auch auf dem Client installiert sein, wenn sie jeweils eine eigene package.json haben.

Um über TCP mit dem Server zu kommunizieren, muss das Package `@deepkit/rpc-tcp` auf Client und Server installiert sein.

```sh
npm install @deepkit/rpc-tcp
```

Für die WebSocket-Kommunikation wird das Package ebenfalls auf dem Server benötigt. Der Client im Browser verwendet hingegen WebSocket aus dem offiziellen Standard.

Wenn der Client auch in einer Umgebung eingesetzt werden soll, in der WebSocket nicht verfügbar ist (zum Beispiel NodeJS), wird das Package ws im Client benötigt.

```sh
npm install ws
```

## Verwendung

Nachfolgend ein vollständig funktionsfähiges Beispiel basierend auf WebSockets und der Low-Level API von @deepkit/rpc. Bei Verwendung des Deepkit Frameworks werden Controller über App-Module bereitgestellt, und ein RpcKernel wird nicht manuell instanziiert.

_Datei: server.ts_

```typescript
import { rpc, RpcKernel } from '@deepkit/rpc';
import { RpcWebSocketServer } from '@deepkit/rpc-tcp';

@rpc.controller('/main')
export class Controller {
    @rpc.action()
    hello(title: string): string {
        return 'Hello ' + title;
    }
}

const kernel = new RpcKernel();
kernel.registerController(Controller);
const server = new RpcWebSocketServer(kernel, 'localhost:8081');
server.start({
    host: '127.0.0.1',
    port: 8081,
});
console.log('Server started at ws://127.0.0.1:8081');

```

_Datei: client.ts_

```typescript
import { RpcWebSocketClient } from '@deepkit/rpc';
import type { Controller } from './server';

async function main() {
    const client = new RpcWebSocketClient('ws://127.0.0.1:8081');
    const controller = client.controller<Controller>('/main');

    const result = await controller.hello('World');
    console.log('result', result);

    client.disconnect();
}

main().catch(console.error);

```

## Server Controller

Der Begriff "Procedure" in Remote Procedure Call wird häufig auch als "Action" bezeichnet. Eine Action ist eine Method, die in einer Class definiert und mit dem Decorator `@rpc.action` markiert ist. Die Class selbst wird mit dem Decorator `@rpc.controller` als Controller markiert und mit einem eindeutigen Namen versehen. Dieser Name wird dann im Client referenziert, um den richtigen Controller anzusprechen. Es können nach Bedarf mehrere Controller definiert und registriert werden.


```typescript
import { rpc } from '@deepkit/rpc';

@rpc.controller('/main');
class Controller {
    @rpc.action()
    hello(title: string): string {
        return 'Hello ' + title;
    }

    @rpc.action()
    test(): boolean {
        return true;
    }
}
```

Nur Methods, die als `@rpc.action()` markiert sind, können von einem Client aufgerufen werden.

Types müssen explizit angegeben werden und können nicht per Type Inference ermittelt werden. Das ist wichtig, da der Serializer genau wissen muss, wie die Types aussehen, um sie in Binärdaten (BSON) oder JSON umzuwandeln, die anschließend über das Netzwerk gesendet werden.

## Client Controller

Der normale Ablauf in RPC ist, dass der Client Functions auf dem Server ausführen kann. In Deepkit RPC ist es jedoch auch möglich, dass der Server Functions auf dem Client ausführt. Um dies zu ermöglichen, kann der Client ebenfalls einen Controller registrieren.

TODO

## Dependency Injection

Wenn das Deepkit Framework verwendet wird, wird die Class vom Dependency Injection-Container instanziiert und hat damit automatisch Zugriff auf alle anderen Provider in der Applikation.

Siehe auch [Dependency Injection](dependency-injection.md#).

## RxJS-Streaming

TODO

## Nominal Types

Wenn der Client Daten von einem Function-Call erhält, wurden diese zuerst auf dem Server serialisiert und dann auf dem Client deserialisiert. Wenn der Return Type der Function Classes enthält, werden diese Classes auf der Client-Seite rekonstruiert, verlieren jedoch ihre nominale Identität und zugehörigen Methods. Um dieses Problem zu beheben, registriere die Classes als nominal Types mit eindeutigen IDs/Namen. Dieser Ansatz sollte auf alle Classes angewendet werden, die innerhalb einer RPC-API verwendet werden.

Um eine Class zu registrieren, verwende den Decorator `@entity.name('id')`.

```typescript
import { entity } from '@deepkit/type';

@entity.name('user')
class User {
    id!: number;
    firstName!: string;
    lastName!: string;
    get fullName() {
        return this.firstName + ' ' + this.lastName;
    }
}
```

Sobald diese Class als Result einer Function verwendet wird, bleibt ihre Identität erhalten.

```typescript
const controller = client.controller<Controller>('/main');

const user = await controller.getUser(2);
user instanceof User; //true, wenn @entity.name verwendet wird, und false, wenn nicht
```