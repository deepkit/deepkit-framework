# Getting Started

To use Deepkit RPC, it is necessary to have `@deepkit/type` correctly installed because it is based on Runtime Types. See [Runtime Type Installation](../runtime-types.md).

Once this is successfully done, `@deepkit/rpc` or the Deepkit Framework, which already uses the library under the hood, can be installed.

```sh
npm install @deepkit/rpc
```

Note that controller classes in `@deepkit/rpc` are based on TypeScript decorators, and this feature must be enabled with experimentalDecorators.

The `@deepkit/rpc` package must be installed on the server and client if they have their own package.json.

To communicate over TCP with the server, the `@deepkit/rpc-tcp` package must be installed on the client and server.

```sh
npm install @deepkit/rpc-tcp
```

For WebSocket communication, the package is also required on the server. The client in the browser, on the other hand, uses WebSocket from the official standard.

If the client is also to be used in an environment where WebSocket is not available (for example, NodeJS), the package ws is required in the client.

```sh
npm install ws
```

## Usage

Below is a fully functional example based on WebSockets and the low-level API of @deepkit/rpc. When using the Deepkit Framework, controllers are provided via app modules, and an RpcKernel is not instantiated manually.

_File: server.ts_

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

_File: client.ts_

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

The term "Procedure" in Remote Procedure Call is also commonly referred to as an "Action". An Action is a method defined in a class and marked with the `@rpc.action` decorator. The class itself is marked as a Controller with the `@rpc.controller` decorator and given a unique name. This name is then referenced in the client to address the correct controller. Multiple controllers can be defined and registered as needed.


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

Only methods marked as `@rpc.action()` can be called by a client.

Types must be explicitly specified and cannot be inferred. This is important because the serializer needs to know exactly what the types look like in order to convert them into binary data (BSON) or JSON which is then sent over the wire.

## Client Controller

The normal flow in RPC is that the client can execute functions on the server. However, in Deepkit RPC, it is also possible for the server to execute functions on the client. To allow this, the client can also register a controller.

TODO

## Dependency Injection

When the Deepkit framework is used, the class is instantiated by the Dependency Injection container and thus automatically has access to all other providers in the application.

See also [Dependency Injection](dependency-injection.md#).

## Streaming RxJS

TODO

## Nominal Types

When the client receives data from a function call, it has first been serialized on the server and then deserialized on the client. If the function's return type includes classes, these classes will be reconstructed on the client side, but they will lose their nominal identity and associated methods. To address this issue, register the classes as nominal types with unique IDs/names. This approach should be applied to all classes used within an RPC-API.

To register a class, use the decorator `@entity.name('id')`.

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

Once this class is used as the result of a function, its identity will be preserved.

```typescript
const controller = client.controller<Controller>('/main');

const user = await controller.getUser(2);
user instanceof User; //true when @entity.name is used, and false if not
```
