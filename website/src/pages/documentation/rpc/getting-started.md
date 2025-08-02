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

```typescript
// Client-side controller
@rpc.controller('/client')
class ClientController {
    @rpc.action()
    notify(message: string): void {
        console.log('Server notification:', message);
    }

    @rpc.action()
    confirm(question: string): boolean {
        return confirm(question);
    }
}

// Register the controller on the client
client.registerController(ClientController, '/client');

// Server can now call client methods
@rpc.controller('/server')
class ServerController {
    constructor(private connection: RpcKernelConnection) {}

    @rpc.action()
    async processData(): Promise<boolean> {
        // Call client controller from server
        const clientController = this.connection.controller<ClientController>('/client');
        await clientController.notify('Processing started...');

        // Ask for confirmation
        const confirmed = await clientController.confirm('Continue processing?');
        return confirmed;
    }
}
```

See [Advanced Features](advanced-features.md) for more information about bidirectional communication.

## Dependency Injection

When the Deepkit framework is used, the class is instantiated by the Dependency Injection container and thus automatically has access to all other providers in the application.

See also [Dependency Injection](dependency-injection.md#).

## Streaming RxJS

Deepkit RPC has native support for RxJS Observables, Subjects, and BehaviorSubjects. You can return these types from your RPC actions and the client will receive them as streaming data.

```typescript
import { Observable, Subject, BehaviorSubject } from 'rxjs';

@rpc.controller('/streaming')
class StreamingController {
    private chatSubject = new Subject<string>();

    @rpc.action()
    getMessages(): Observable<string> {
        return new Observable<string>((observer) => {
            observer.next('Welcome!');
            observer.next('How are you?');
            observer.complete();
        });
    }

    @rpc.action()
    getChatChannel(): Subject<string> {
        return this.chatSubject;
    }

    @rpc.action()
    sendMessage(message: string): void {
        this.chatSubject.next(message);
    }

    @rpc.action()
    getStatus(): BehaviorSubject<string> {
        return new BehaviorSubject<string>('online');
    }
}
```

On the client side:

```typescript
const controller = client.controller<StreamingController>('/streaming');

// Subscribe to messages
const messages = await controller.getMessages();
messages.subscribe(message => {
    console.log('Received:', message);
});

// Subscribe to chat channel
const chat = await controller.getChatChannel();
chat.subscribe(message => {
    console.log('Chat:', message);
});

// Send a message (will be received by all subscribers)
await controller.sendMessage('Hello everyone!');

// Get current status with BehaviorSubject
const status = await controller.getStatus();
console.log('Current status:', status.getValue());
```

See [Streaming](streaming.md) for more detailed information.

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

## Validation

Deepkit RPC automatically validates parameters and return values using TypeScript types and validation decorators:

```typescript
import { MinLength, MaxLength, Email, Positive } from '@deepkit/type';

@entity.name('user-input')
class UserInput {
    @MinLength(2)
    @MaxLength(50)
    name!: string;

    @Email()
    email!: string;

    @Positive()
    age!: number;
}

@rpc.controller('/validation')
class ValidationController {
    @rpc.action()
    createUser(input: UserInput): { success: boolean, id?: number } {
        // Validation happens automatically before this method is called
        // If validation fails, an error is thrown to the client

        const userId = Math.floor(Math.random() * 1000);
        return { success: true, id: userId };
    }

    @rpc.action()
    updateAge(userId: number, @Positive() newAge: number): boolean {
        // Individual parameter validation
        console.log(`Updating user ${userId} age to ${newAge}`);
        return true;
    }
}
```

Client usage with validation:

```typescript
const controller = client.controller<ValidationController>('/validation');

try {
    // This will succeed
    const result = await controller.createUser({
        name: 'John Doe',
        email: 'john@example.com',
        age: 25
    });
    console.log('User created:', result);
} catch (error) {
    // This will catch validation errors
    console.error('Validation failed:', error.message);
}

try {
    // This will fail validation (negative age)
    await controller.updateAge(1, -5);
} catch (error) {
    console.error('Age validation failed:', error.message);
}
```

See [Advanced Features](advanced-features.md) for more validation examples.

## RPC Interfaces

For larger applications, it's recommended to use RPC interfaces to define type-safe contracts between your client and server:

```typescript
// shared/interfaces.ts
import { ControllerSymbol } from '@deepkit/rpc';

const UserRpcInterface = ControllerSymbol<UserRpcController>('user');

interface UserRpcController {
    getUser(id: number): Promise<User>;
    createUser(userData: CreateUserData): Promise<User>;
    listUsers(): Promise<User[]>;
}

export { UserRpcInterface };
export type { UserRpcController };
```

Server implementation:

```typescript
// server.ts
import { UserRpcInterface, UserRpcController } from './shared/interfaces.js';

@rpc.controller(UserRpcInterface)
class UserRpcControllerImpl implements UserRpcController {
    async getUser(id: number): Promise<User> {
        // Implementation
        return new User(id, 'John Doe', 'john@example.com');
    }

    async createUser(userData: CreateUserData): Promise<User> {
        // Implementation
        return new User(Date.now(), userData.name, userData.email);
    }

    async listUsers(): Promise<User[]> {
        // Implementation
        return [];
    }
}
```

Client usage:

```typescript
// client.ts
import { UserRpcInterface, UserRpcController } from './shared/interfaces.js';

const client = new RpcWebSocketClient('ws://127.0.0.1:8081');
const userController = client.controller<UserRpcController>(UserRpcInterface);

// Full type safety!
const user = await userController.getUser(1);
const users = await userController.listUsers();
```

See [RPC Interfaces](interfaces.md) for comprehensive documentation on creating type-safe RPC contracts.
