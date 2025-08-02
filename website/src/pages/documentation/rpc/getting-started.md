# Getting Started

## What is Deepkit RPC?

Deepkit RPC is a modern, type-safe Remote Procedure Call (RPC) framework that enables seamless communication between TypeScript applications. Unlike traditional REST APIs or GraphQL, Deepkit RPC allows you to call server functions directly from your client code as if they were local functions, while maintaining full TypeScript type safety across the network boundary.

### Key Features

- **Full Type Safety**: TypeScript types are preserved across client-server communication
- **Real-time Streaming**: Native support for RxJS Observables, Subjects, and BehaviorSubjects
- **Bidirectional Communication**: Both client and server can call methods on each other
- **Multiple Transport Protocols**: WebSockets, TCP, and HTTP support
- **Automatic Serialization**: Complex objects, classes, and binary data are handled automatically
- **Built-in Validation**: Automatic parameter and return value validation
- **Peer-to-Peer Communication**: Direct client-to-client communication through the server
- **Progress Tracking**: Built-in progress tracking for large data transfers

### How It Works

Deepkit RPC uses TypeScript's runtime type information (via `@deepkit/type`) to:

1. **Serialize/Deserialize Data**: Convert complex TypeScript objects to binary format (BSON) for efficient network transmission
2. **Validate Parameters**: Automatically validate function parameters and return values
3. **Preserve Type Identity**: Maintain class instances and their methods across the network
4. **Generate Type-Safe Clients**: Create fully typed client interfaces that match server implementations

The framework operates on a controller-action pattern where:
- **Controllers** are classes that group related functionality
- **Actions** are methods within controllers that can be called remotely
- **Clients** connect to servers and call actions through type-safe proxies

## Installation

### Prerequisites

Deepkit RPC requires `@deepkit/type` for runtime type information. See [Runtime Type Installation](../runtime-types.md) for detailed setup instructions.

### Core Package

```sh
npm install @deepkit/rpc
```

**Important**: Enable TypeScript decorators in your `tsconfig.json`:

```json
{
  "compilerOptions": {
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true
  }
}
```

### Transport Packages

Choose the appropriate transport package based on your needs:

#### WebSocket Transport (Recommended)
```sh
npm install @deepkit/rpc-tcp
```

WebSockets provide the best balance of features and compatibility:
- ✅ Works in browsers and Node.js
- ✅ Supports all RPC features (streaming, bidirectional communication)
- ✅ Efficient binary protocol
- ✅ Real-time capabilities

#### TCP Transport (Server-to-Server)
```sh
npm install @deepkit/rpc-tcp
```

TCP is ideal for microservice communication:
- ✅ Highest performance
- ✅ Supports all RPC features
- ❌ Not available in browsers
- ✅ Perfect for server-to-server communication

#### Node.js WebSocket Client
If using WebSocket clients in Node.js environments:

```sh
npm install ws
```

## Quick Start Example

Let's build a simple chat application to demonstrate Deepkit RPC's core concepts. This example shows the fundamental client-server communication pattern.

### Understanding the Architecture

Before diving into code, it's important to understand how Deepkit RPC works:

1. **Server Side**: Define controllers with actions that clients can call
2. **Client Side**: Create typed proxies that call server actions as if they were local functions
3. **Type Safety**: TypeScript types are preserved and validated across the network
4. **Serialization**: Complex objects are automatically converted to efficient binary format

### Server Implementation

The server defines what functionality is available to clients through controllers and actions.

_File: server.ts_

```typescript
import { rpc, RpcKernel } from '@deepkit/rpc';
import { RpcWebSocketServer } from '@deepkit/rpc-tcp';

// Define a controller - a group of related functionality
@rpc.controller('/main')
export class Controller {
    // Define an action - a method that clients can call
    @rpc.action()
    hello(title: string): string {
        return 'Hello ' + title;
    }

    // Actions can be async and return complex types
    @rpc.action()
    async getUserInfo(userId: number): Promise<{ id: number, name: string, email: string }> {
        // In a real app, this would query a database
        return {
            id: userId,
            name: 'John Doe',
            email: 'john@example.com'
        };
    }
}

// Create the RPC kernel - the core that manages controllers
const kernel = new RpcKernel();
kernel.registerController(Controller);

// Create a WebSocket server to handle client connections
const server = new RpcWebSocketServer(kernel, 'localhost:8081');
server.start({
    host: '127.0.0.1',
    port: 8081,
});

console.log('Server started at ws://127.0.0.1:8081');
console.log('Available actions:');
console.log('- /main.hello(title: string): string');
console.log('- /main.getUserInfo(userId: number): Promise<UserInfo>');
```

### Client Implementation

The client connects to the server and calls actions through type-safe proxies.

_File: client.ts_

```typescript
import { RpcWebSocketClient } from '@deepkit/rpc';
import type { Controller } from './server';

async function main() {
    // Create a WebSocket client connection
    const client = new RpcWebSocketClient('ws://127.0.0.1:8081');

    // Get a typed controller proxy - this gives you full TypeScript intellisense
    const controller = client.controller<Controller>('/main');

    try {
        // Call server actions as if they were local functions
        // TypeScript knows the exact parameter and return types
        const greeting = await controller.hello('World');
        console.log('Greeting:', greeting); // "Hello World"

        // Call async actions - the Promise is handled automatically
        const userInfo = await controller.getUserInfo(123);
        console.log('User info:', userInfo); // { id: 123, name: 'John Doe', email: 'john@example.com' }

        // TypeScript will catch type errors at compile time
        // controller.hello(123); // ❌ Error: Argument of type 'number' is not assignable to parameter of type 'string'

    } catch (error) {
        console.error('RPC call failed:', error);
    } finally {
        // Clean up the connection
        client.disconnect();
    }
}

main().catch(console.error);
```

### What's Happening Under the Hood

When you call `controller.hello('World')`:

1. **Type Checking**: TypeScript validates that 'World' is a valid string parameter
2. **Serialization**: The string parameter is serialized to BSON format
3. **Network Transport**: The serialized data is sent over the WebSocket connection
4. **Server Execution**: The server deserializes the parameter and calls the actual method
5. **Response Serialization**: The return value is serialized and sent back
6. **Client Deserialization**: The client receives and deserializes the response
7. **Type Safety**: The result is typed as `string` in your client code

All of this happens transparently - you just call the function and get the result!

## Understanding Controllers and Actions

### What are Controllers?

Controllers in Deepkit RPC are classes that group related functionality together. Think of them as service endpoints that expose specific capabilities to clients. Each controller has a unique path (like `/users` or `/auth`) that clients use to access its functionality.

### What are Actions?

Actions are the individual methods within a controller that clients can call remotely. The term "action" is used instead of "method" to emphasize that these are remote procedure calls - they execute on the server but are called from the client.

### Controller Design Principles

When designing controllers, follow these principles:

1. **Single Responsibility**: Each controller should handle one domain or feature area
2. **Logical Grouping**: Group related actions together (e.g., user management, file operations)
3. **Clear Naming**: Use descriptive controller paths and action names
4. **Consistent Interface**: Maintain consistent parameter and return patterns

### Basic Controller Structure

```typescript
import { rpc } from '@deepkit/rpc';

// The controller decorator defines the path clients use to access this controller
@rpc.controller('/main')
class Controller {
    // Only methods marked with @rpc.action() are accessible to clients
    @rpc.action()
    hello(title: string): string {
        return 'Hello ' + title;
    }

    @rpc.action()
    test(): boolean {
        return true;
    }

    // This method is NOT accessible to clients (no @rpc.action decorator)
    private internalMethod(): void {
        // Internal server logic
    }
}
```

### Why Explicit Types Matter

Deepkit RPC requires explicit type annotations because:

1. **Runtime Type Information**: The serializer needs to know exact types to convert data to binary format (BSON)
2. **Validation**: Parameters and return values are validated against their declared types
3. **Client Generation**: Type information is used to create type-safe client proxies
4. **Cross-Language Support**: Explicit types enable potential future support for other languages

```typescript
// ✅ Good - explicit types
@rpc.action()
getUserById(id: number): Promise<User> {
    return this.userService.findById(id);
}

// ❌ Bad - inferred types won't work properly
@rpc.action()
getUserById(id) {  // Type inference doesn't provide runtime type info
    return this.userService.findById(id);
}
```

### Controller Organization Patterns

#### Feature-Based Controllers

```typescript
@rpc.controller('/users')
class UserController {
    @rpc.action()
    create(userData: CreateUserData): Promise<User> { /* ... */ }

    @rpc.action()
    getById(id: number): Promise<User> { /* ... */ }

    @rpc.action()
    update(id: number, updates: Partial<User>): Promise<User> { /* ... */ }

    @rpc.action()
    delete(id: number): Promise<boolean> { /* ... */ }
}

@rpc.controller('/auth')
class AuthController {
    @rpc.action()
    login(credentials: LoginCredentials): Promise<AuthResult> { /* ... */ }

    @rpc.action()
    logout(): Promise<void> { /* ... */ }

    @rpc.action()
    refreshToken(token: string): Promise<AuthResult> { /* ... */ }
}
```

#### Hierarchical Controllers

```typescript
@rpc.controller('/api/v1/users')
class UserV1Controller { /* ... */ }

@rpc.controller('/api/v2/users')
class UserV2Controller { /* ... */ }

@rpc.controller('/admin/users')
class AdminUserController { /* ... */ }
```

## Bidirectional Communication

One of Deepkit RPC's unique features is bidirectional communication - not only can clients call server methods, but servers can also call methods on connected clients. This enables powerful patterns like real-time notifications, user confirmations, and collaborative features.

### Why Bidirectional Communication?

Traditional RPC systems are unidirectional: clients make requests to servers. Bidirectional RPC enables:

- **Real-time Notifications**: Servers can push updates to specific clients
- **User Interactions**: Servers can ask clients for confirmations or input
- **Collaborative Features**: Multiple clients can interact through the server
- **Event-Driven Architecture**: Servers can notify clients of state changes
- **Progressive Operations**: Servers can update clients on long-running task progress

### Client-Side Controllers

Clients can register controllers that servers can call:

```typescript
// Define a client-side controller for receiving server calls
@rpc.controller('/client')
class ClientController {
    @rpc.action()
    notify(message: string, type: 'info' | 'warning' | 'error' = 'info'): void {
        // Handle server notifications
        console.log(`[${type.toUpperCase()}] ${message}`);

        // In a real application, you might show a toast notification
        this.showNotification(message, type);
    }

    @rpc.action()
    confirm(question: string): boolean {
        // Server is asking for user confirmation
        return confirm(question);
    }

    @rpc.action()
    updateProgress(current: number, total: number, operation: string): void {
        // Server is reporting progress on a long-running operation
        const percentage = Math.round((current / total) * 100);
        console.log(`${operation}: ${percentage}% complete`);
        this.updateProgressBar(percentage);
    }

    private showNotification(message: string, type: string): void {
        // Implementation depends on your UI framework
    }

    private updateProgressBar(percentage: number): void {
        // Update UI progress indicator
    }
}

// Register the controller on the client
client.registerController(ClientController, '/client');
```

### Server-Side Bidirectional Communication

Servers can call client methods through the connection object:

```typescript
import { RpcKernelConnection } from '@deepkit/rpc';

@rpc.controller('/server')
class ServerController {
    // The connection is injected automatically and represents the current client
    constructor(private connection: RpcKernelConnection) {}

    @rpc.action()
    async processLargeDataset(datasetId: string): Promise<{ success: boolean, recordsProcessed: number }> {
        // Get a proxy to the client's controller
        const clientController = this.connection.controller<ClientController>('/client');

        // Notify client that processing is starting
        await clientController.notify('Starting dataset processing...', 'info');

        // Ask for confirmation before proceeding
        const confirmed = await clientController.confirm(
            'This operation will take several minutes. Continue?'
        );

        if (!confirmed) {
            await clientController.notify('Operation cancelled by user', 'warning');
            return { success: false, recordsProcessed: 0 };
        }

        // Simulate processing with progress updates
        const totalRecords = 10000;
        let processedRecords = 0;

        for (let batch = 0; batch < 10; batch++) {
            // Process a batch of records
            await this.processBatch(datasetId, batch);
            processedRecords += 1000;

            // Update client on progress
            await clientController.updateProgress(
                processedRecords,
                totalRecords,
                'Processing dataset'
            );

            // Simulate processing time
            await new Promise(resolve => setTimeout(resolve, 500));
        }

        // Notify completion
        await clientController.notify('Dataset processing completed successfully!', 'info');

        return { success: true, recordsProcessed: totalRecords };
    }

    private async processBatch(datasetId: string, batchNumber: number): Promise<void> {
        // Actual batch processing logic
    }
}
```

### Use Cases for Bidirectional Communication

1. **Real-time Dashboards**: Server pushes live data updates to dashboard clients
2. **Collaborative Editing**: Multiple users editing the same document with real-time sync
3. **Admin Operations**: Admin interface that can send commands to specific client instances
4. **Gaming**: Real-time multiplayer game state synchronization
5. **Monitoring**: Server health monitoring with real-time alerts to admin clients
6. **Chat Applications**: Real-time message delivery between users

See [Advanced Features](advanced-features.md) for more detailed information about bidirectional communication patterns.

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
