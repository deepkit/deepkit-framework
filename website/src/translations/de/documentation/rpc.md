# RPC

RPC, kurz für Remote Procedure Call, ermöglicht es, Funktionen auf einem entfernten Server so aufzurufen, als wären es lokale Funktionen. Anders als bei der HTTP-Client-Server-Kommunikation, die HTTP-Methoden und eine URL für das Mapping verwendet, nutzt RPC den Funktionsnamen für das Mapping. Die zu sendenden Daten werden als normale Funktionsargumente übergeben, und das Ergebnis des Funktionsaufrufs auf dem Server wird an den Client zurückgesendet.

Der Vorteil von RPC ist, dass die Client-Server-Abstraktion leichtgewichtig ist, da sie nicht mit Headers, URLs, Query Strings oder Ähnlichem arbeitet. Der Nachteil ist, dass Funktionen auf einem Server via RPC nicht einfach von einem Browser aufgerufen werden können und häufig einen spezifischen Client erfordern.

Ein zentrales Merkmal von RPC ist, dass die Daten zwischen Client und Server automatisch serialisiert und deserialisiert werden. Daher sind üblicherweise typesafe RPC-Clients möglich. Einige RPC-Frameworks zwingen Nutzer dazu, Types (Parameter Types und Return Types) in einem speziellen Format bereitzustellen. Das kann in Form einer DSL wie Protocol Buffers für gRPC und GraphQL oder eines JavaScript Schema Builders geschehen. Zusätzliche Data Validation kann ebenfalls vom RPC-Framework bereitgestellt werden, wird jedoch nicht von allen unterstützt.

Deepkit RPC extrahiert Types direkt aus dem TypeScript-Code, sodass es nicht notwendig ist, einen Code Generator zu verwenden oder sie manuell zu definieren. Deepkit unterstützt die automatische Serialisierung und Deserialisierung von Parametern und Ergebnissen. Sobald zusätzliche Einschränkungen in Validation definiert sind, werden sie automatisch validiert. Das macht die Kommunikation über RPC äußerst typesafe und effizient. Die Unterstützung für Streaming über `rxjs` in Deepkit RPC macht dieses RPC-Framework zu einem geeigneten Werkzeug für Echtzeitkommunikation.

Um das Konzept hinter RPC zu veranschaulichen, betrachten Sie den folgenden Code:

```typescript
//server.ts
class Controller {
    hello(title: string): string {
        return 'Hello ' + title
    }
}
```

Eine Method wie hello wird auf dem Server innerhalb einer Class genau wie eine normale Function implementiert und kann von einem Remote-Client aufgerufen werden.

```typescript
//client.ts
const client = new RpcClient('localhost');
const controller = client.controller<Controller>();

const result = await controller.hello('World'); // => 'Hello World';
```

Da RPC grundsätzlich auf asynchroner Kommunikation basiert, erfolgt die Kommunikation in der Regel über HTTP, kann aber auch über TCP oder WebSockets stattfinden. Das bedeutet, dass alle Funktionsaufrufe in TypeScript selbst in ein `Promise` umgewandelt werden. Das Ergebnis kann asynchron mit einem entsprechenden `await` empfangen werden.

## Isomorphic TypeScript

Wenn ein Projekt TypeScript sowohl auf dem Client (meist Frontend) als auch auf dem Server (Backend) verwendet, spricht man von Isomorphic TypeScript. Ein typesafe RPC-Framework, das auf den Types von TypeScript basiert, ist für ein solches Projekt besonders vorteilhaft, da Types zwischen Client und Server geteilt werden können.

Um dies zu nutzen, sollten Types, die auf beiden Seiten verwendet werden, in eine eigene Datei oder ein eigenes Package ausgelagert werden. Das Importieren auf der jeweiligen Seite führt sie dann wieder zusammen.

```typescript
//shared.ts
export class User {
    id: number;
    username: string;
}

//server.ts
import { User } from './shared';

@rpc.controller('/user')
class UserController  {
    async getUser(id: number): Promise<User> {
        return await datbase.query(User).filter({id}).findOne();
    }
}

//client.ts
import { UserControllerApi } from './shared';
import type { UserController } from './server.ts'
const controller = client.controller<UserController>('/user');
const user = await controller.getUser(2); // => User
```

Abwärtskompatibilität kann auf die gleiche Weise umgesetzt werden wie bei einer normalen lokalen API: Entweder werden neue Parameter als optional markiert oder es wird eine neue Method hinzugefügt.