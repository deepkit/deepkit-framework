# RPC (Remote Procedure Call)

Deepkit Framework provides a powerful RPC system that allows real-time communication between client and server using WebSockets. RPC controllers enable you to build APIs that feel like local function calls.

## Basic RPC Controller

Create an RPC controller using the `@rpc.controller` decorator:

```typescript
import { rpc } from '@deepkit/rpc';

@rpc.controller('main')
class MainController {
    @rpc.action()
    hello(name: string): string {
        return `Hello ${name}!`;
    }
    
    @rpc.action()
    async getUser(id: number): Promise<User> {
        // Async operations work seamlessly
        return await this.userService.findById(id);
    }
}
```

Register the controller in your app:

```typescript
import { App } from '@deepkit/app';
import { FrameworkModule } from '@deepkit/framework';

const app = new App({
    controllers: [MainController],
    imports: [new FrameworkModule()]
});
```

## RPC Client Usage

### TypeScript Client

```typescript
import { RpcClient } from '@deepkit/rpc';

// Create client
const client = new RpcClient('ws://localhost:8080');
await client.connect();

// Get controller proxy
const controller = client.controller<MainController>('main');

// Call methods as if they were local
const result = await controller.hello('World');
console.log(result); // "Hello World!"

// Type safety is preserved
const user = await controller.getUser(123);
```

### JavaScript Client

```javascript
import { RpcClient } from '@deepkit/rpc';

const client = new RpcClient('ws://localhost:8080');
await client.connect();

const controller = client.controller('main');
const result = await controller.hello('World');
```

## Dependency Injection in RPC Controllers

RPC controllers support full dependency injection:

```typescript
class UserService {
    async findById(id: number): Promise<User> {
        // Database logic
    }
}

@rpc.controller('users')
class UserController {
    constructor(
        private userService: UserService,
        private logger: Logger
    ) {}
    
    @rpc.action()
    async getUser(id: number): Promise<User> {
        this.logger.log(`Getting user ${id}`);
        return await this.userService.findById(id);
    }
}

const app = new App({
    providers: [UserService],
    controllers: [UserController],
    imports: [new FrameworkModule()]
});
```

## RPC Context and Session

Access request context and session information:

```typescript
import { RpcKernelConnection, SessionState } from '@deepkit/rpc';

@rpc.controller('auth')
class AuthController {
    constructor(
        private connection: RpcKernelConnection,
        private sessionState: SessionState
    ) {}
    
    @rpc.action()
    getCurrentUser() {
        const session = this.sessionState.getSession();
        return session.username;
    }
    
    @rpc.action()
    getConnectionInfo() {
        return {
            id: this.connection.id,
            remoteAddress: this.connection.remoteAddress
        };
    }
}
```

## Authentication and Security

Implement RPC authentication:

```typescript
import { RpcKernelSecurity, Session } from '@deepkit/rpc';

class MyRpcSecurity extends RpcKernelSecurity {
    async authenticate(token: any): Promise<Session> {
        if (token === 'valid-token') {
            return new Session('user123', token);
        }
        throw new Error('Invalid token');
    }
}

const app = new App({
    providers: [
        { provide: RpcKernelSecurity, useClass: MyRpcSecurity }
    ],
    controllers: [AuthController],
    imports: [new FrameworkModule()]
});
```

Client authentication:

```typescript
const client = new RpcClient('ws://localhost:8080');
await client.connect();

// Authenticate
await client.authenticate('valid-token');

// Now authenticated calls work
const controller = client.controller('auth');
const user = await controller.getCurrentUser();
```

## Error Handling

Handle errors in RPC methods:

```typescript
@rpc.controller('api')
class ApiController {
    @rpc.action()
    async riskyOperation(data: any) {
        try {
            return await this.processData(data);
        } catch (error) {
            // Errors are automatically serialized and sent to client
            throw new Error(`Processing failed: ${error.message}`);
        }
    }
}
```

Client error handling:

```typescript
try {
    await controller.riskyOperation(invalidData);
} catch (error) {
    console.error('RPC call failed:', error.message);
}
```

## Streaming and Observables

RPC supports streaming data using RxJS observables:

```typescript
import { Observable, interval } from 'rxjs';
import { map } from 'rxjs/operators';

@rpc.controller('stream')
class StreamController {
    @rpc.action()
    getTimeStream(): Observable<string> {
        return interval(1000).pipe(
            map(() => new Date().toISOString())
        );
    }
    
    @rpc.action()
    async *generateNumbers(count: number) {
        for (let i = 0; i < count; i++) {
            yield i;
            await new Promise(resolve => setTimeout(resolve, 100));
        }
    }
}
```

Client streaming consumption:

```typescript
const controller = client.controller('stream');

// Observable stream
const timeStream = await controller.getTimeStream();
timeStream.subscribe(time => {
    console.log('Current time:', time);
});

// Async generator
const numbers = await controller.generateNumbers(10);
for await (const number of numbers) {
    console.log('Number:', number);
}
```

## HTTP-based RPC

Enable RPC calls over HTTP for easier integration:

```typescript
new FrameworkModule({
    httpRpcBasePath: '/rpc/v1'
})
```

Now RPC methods are available via HTTP POST:

```bash
curl -X POST http://localhost:8080/rpc/v1/main/hello \
  -H "Content-Type: application/json" \
  -d '{"name": "World"}'
```

## Testing RPC Controllers

Use the testing utilities for RPC testing:

```typescript
import { createTestingApp } from '@deepkit/framework';

test('rpc controller', async () => {
    const testing = createTestingApp({
        controllers: [MainController]
    });
    
    await testing.startServer();
    
    const client = testing.createRpcClient();
    const controller = client.controller<MainController>('main');
    
    const result = await controller.hello('Test');
    expect(result).toBe('Hello Test!');
    
    await testing.stopServer();
});
```

## RPC Controller Organization

Organize controllers by feature:

```typescript
// User management
@rpc.controller('users')
class UserController {
    @rpc.action()
    async create(userData: CreateUserData) { }
    
    @rpc.action()
    async update(id: number, data: UpdateUserData) { }
}

// File operations
@rpc.controller('files')
class FileController {
    @rpc.action()
    async upload(file: FileData) { }
    
    @rpc.action()
    async download(id: string) { }
}

// Real-time notifications
@rpc.controller('notifications')
class NotificationController {
    @rpc.action()
    getNotificationStream(): Observable<Notification> {
        return this.notificationService.stream();
    }
}
```

## Advanced RPC Features

### Custom Controller Names

Use symbols for type-safe controller references:

```typescript
import { ControllerSymbol } from '@deepkit/rpc';

const UserControllerSymbol = ControllerSymbol<UserController>('users');

@rpc.controller(UserControllerSymbol)
class UserController {
    // Implementation
}

// Type-safe client usage
const controller = client.controller(UserControllerSymbol);
```

### RPC Modules

Organize RPC controllers in modules:

```typescript
import { AppModule } from '@deepkit/app';

const UserModule = new AppModule({
    controllers: [UserController],
    providers: [UserService]
}, 'user');

const app = new App({
    imports: [
        UserModule,
        new FrameworkModule()
    ]
});
```

## Performance Considerations

1. **Connection Pooling**: Reuse RPC clients when possible
2. **Streaming**: Use observables for large datasets
3. **Batching**: Group related RPC calls
4. **Caching**: Cache frequently accessed data
5. **Error Handling**: Implement proper error boundaries

## Best Practices

1. **Type Safety**: Use TypeScript interfaces for RPC methods
2. **Authentication**: Implement proper security for sensitive operations
3. **Error Handling**: Provide meaningful error messages
4. **Testing**: Write comprehensive tests for RPC controllers
5. **Documentation**: Document RPC APIs for client developers
6. **Versioning**: Plan for API versioning from the start

## Next Steps

- [Authentication](../auth.md) - Implementing authentication
- [Testing](./testing.md) - Testing RPC functionality
- [WebSockets](../websocket.md) - Advanced WebSocket features
- [Real-time Features](../realtime.md) - Building real-time applications
