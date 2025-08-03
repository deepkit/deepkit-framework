# RPC Interfaces

## The Power of Type-Safe Contracts

RPC interfaces represent one of Deepkit RPC's most powerful features: the ability to define type-safe contracts between your client and server that are enforced at compile time, runtime, and across the network boundary. This goes far beyond simple API documentation - it creates a living contract that prevents integration bugs and enables confident refactoring.

### Why RPC Interfaces Matter

Traditional API development suffers from several problems:

1. **API Drift**: Client and server implementations diverge over time
2. **Runtime Errors**: Type mismatches are only discovered at runtime
3. **Documentation Lag**: API documentation becomes outdated
4. **Refactoring Fear**: Changing APIs is risky due to unknown dependencies
5. **Integration Bugs**: Client-server integration issues are common

RPC interfaces solve these problems by:

- **Compile-Time Safety**: TypeScript catches type mismatches before deployment
- **Living Documentation**: The interface IS the documentation and it's always current
- **Refactoring Confidence**: Changes to interfaces are caught immediately
- **Contract Enforcement**: Both client and server must implement the same interface
- **IDE Support**: Full IntelliSense and auto-completion across the network boundary

### How RPC Interfaces Work

```
┌─────────────────┐    Shared Interface    ┌─────────────────┐
│     Client      │ ←─────────────────────→ │     Server      │
│                 │                        │                 │
│ controller<T>() │ ← Type-Safe Proxy ←    │ implements T    │
│                 │                        │                 │
│ Compile-Time    │    Runtime Validation  │ Compile-Time    │
│ Type Checking   │ ←─────────────────────→ │ Type Checking   │
└─────────────────┘                        └─────────────────┘
```

The interface serves as a contract that:
1. **Client** uses to generate type-safe method calls
2. **Server** implements to ensure API compliance
3. **TypeScript** uses to validate both sides at compile time
4. **Deepkit RPC** uses to validate data at runtime

### Interface Architecture

RPC interfaces consist of three main components:

1. **ControllerSymbol**: A unique identifier that links client and server
2. **TypeScript Interface**: Defines the method signatures and types
3. **Entity Classes**: Define the data structures used in the interface

## Basic Interface Definition

Create shared interfaces that define the contract between client and server:

```typescript
// shared/interfaces.ts
import { ControllerSymbol } from '@deepkit/rpc';

// Define the controller symbol
const UserRpcInterface = ControllerSymbol<UserRpcController>('user');

// Define the interface contract
interface UserRpcController {
    getUser(id: number): Promise<User>;
    createUser(userData: CreateUserData): Promise<User>;
    updateUser(id: number, updates: Partial<User>): Promise<User>;
    deleteUser(id: number): Promise<boolean>;
    listUsers(page?: number, limit?: number): Promise<User[]>;
}

// Export both the symbol and interface
export { UserRpcInterface };
export type { UserRpcController };
```

### Controller Symbol with Entities

You can also specify entity classes that should be automatically registered for the controller:

```typescript
// shared/interfaces.ts
import { ControllerSymbol } from '@deepkit/rpc';
import { User, CreateUserData } from './types.js';

// Include entity classes for automatic registration
const UserRpcInterface = ControllerSymbol<UserRpcController>('user', [User, CreateUserData]);

interface UserRpcController {
    getUser(id: number): Promise<User>;
    createUser(userData: CreateUserData): Promise<User>;
    listUsers(): Promise<User[]>;
}

export { UserRpcInterface };
export type { UserRpcController };
```

This ensures that the `User` and `CreateUserData` classes are properly registered for serialization when using this controller.

## Server Implementation

Implement the interface on the server side:

```typescript
// server/controllers/user.controller.ts
import { rpc } from '@deepkit/rpc';
import { UserRpcInterface, UserRpcController } from '../shared/interfaces.js';

@rpc.controller(UserRpcInterface)
class UserRpcControllerImpl implements UserRpcController {
    constructor(private userService: UserService) {}

    async getUser(id: number): Promise<User> {
        return await this.userService.findById(id);
    }

    async createUser(userData: CreateUserData): Promise<User> {
        return await this.userService.create(userData);
    }

    async updateUser(id: number, updates: Partial<User>): Promise<User> {
        return await this.userService.update(id, updates);
    }

    async deleteUser(id: number): Promise<boolean> {
        return await this.userService.delete(id);
    }

    async listUsers(page: number = 0, limit: number = 10): Promise<User[]> {
        return await this.userService.findMany({ page, limit });
    }
}
```

## Client Usage

Use the interface on the client side with full type safety:

```typescript
// client/services/user.service.ts
import { DeepkitClient } from '@deepkit/rpc';
import { UserRpcInterface, UserRpcController } from '../shared/interfaces.js';

class UserService {
    private userController: UserRpcController;

    constructor(private client: DeepkitClient) {
        // Get typed controller using the symbol
        this.userController = client.controller<UserRpcController>(UserRpcInterface);
    }

    async getUser(id: number): Promise<User> {
        // Full type safety - TypeScript knows the exact method signature
        return await this.userController.getUser(id);
    }

    async createUser(userData: CreateUserData): Promise<User> {
        return await this.userController.createUser(userData);
    }

    async updateUser(id: number, updates: Partial<User>): Promise<User> {
        return await this.userController.updateUser(id, updates);
    }

    async deleteUser(id: number): Promise<boolean> {
        return await this.userController.deleteUser(id);
    }

    async listUsers(page?: number, limit?: number): Promise<User[]> {
        return await this.userController.listUsers(page, limit);
    }
}
```

## Multiple Interfaces

Organize your application with multiple RPC interfaces:

```typescript
// shared/interfaces.ts
import { ControllerSymbol } from '@deepkit/rpc';

// User management interface
const UserRpcInterface = ControllerSymbol<UserRpcController>('user');
interface UserRpcController {
    getUser(id: number): Promise<User>;
    createUser(userData: CreateUserData): Promise<User>;
    listUsers(filters?: UserFilters): Promise<User[]>;
}

// Product management interface
const ProductRpcInterface = ControllerSymbol<ProductRpcController>('product');
interface ProductRpcController {
    getProduct(id: number): Promise<Product>;
    createProduct(productData: CreateProductData): Promise<Product>;
    searchProducts(query: string): Promise<Product[]>;
    updateInventory(id: number, quantity: number): Promise<Product>;
}

// Order management interface
const OrderRpcInterface = ControllerSymbol<OrderRpcController>('order');
interface OrderRpcController {
    createOrder(orderData: CreateOrderData): Promise<Order>;
    getOrder(id: number): Promise<Order>;
    updateOrderStatus(id: number, status: OrderStatus): Promise<Order>;
    getUserOrders(userId: number): Promise<Order[]>;
}

export {
    UserRpcInterface,
    ProductRpcInterface,
    OrderRpcInterface
};

export type {
    UserRpcController,
    ProductRpcController,
    OrderRpcController
};
```

## Streaming Interfaces

Define interfaces that include streaming methods:

```typescript
// shared/streaming-interfaces.ts
import { Observable, Subject } from 'rxjs';
import { ControllerSymbol } from '@deepkit/rpc';

const ChatRpcInterface = ControllerSymbol<ChatRpcController>('chat');

interface ChatRpcController {
    // Regular methods
    joinRoom(roomId: string, userId: string): Promise<ChatRoom>;
    leaveRoom(roomId: string, userId: string): Promise<void>;
    
    // Streaming methods
    getRoomMessages(roomId: string): Observable<ChatMessage>;
    subscribeToRoom(roomId: string): Subject<ChatMessage>;
    
    // Send message (triggers updates to subscribers)
    sendMessage(roomId: string, message: ChatMessage): Promise<void>;
}

export { ChatRpcInterface };
export type { ChatRpcController };
```

Server implementation with streaming:

```typescript
@rpc.controller(ChatRpcInterface)
class ChatRpcControllerImpl implements ChatRpcController {
    private roomSubjects = new Map<string, Subject<ChatMessage>>();

    async joinRoom(roomId: string, userId: string): Promise<ChatRoom> {
        // Implementation
        return await this.chatService.joinRoom(roomId, userId);
    }

    async leaveRoom(roomId: string, userId: string): Promise<void> {
        await this.chatService.leaveRoom(roomId, userId);
    }

    getRoomMessages(roomId: string): Observable<ChatMessage> {
        return new Observable(observer => {
            // Stream historical messages
            this.chatService.getMessages(roomId).then(messages => {
                messages.forEach(msg => observer.next(msg));
                observer.complete();
            });
        });
    }

    subscribeToRoom(roomId: string): Subject<ChatMessage> {
        if (!this.roomSubjects.has(roomId)) {
            this.roomSubjects.set(roomId, new Subject<ChatMessage>());
        }
        return this.roomSubjects.get(roomId)!;
    }

    async sendMessage(roomId: string, message: ChatMessage): Promise<void> {
        await this.chatService.saveMessage(roomId, message);
        
        // Notify subscribers
        const subject = this.roomSubjects.get(roomId);
        if (subject) {
            subject.next(message);
        }
    }
}
```

## Interface Validation

Ensure your implementations match the interface using TypeScript:

```typescript
// This will cause a TypeScript error if the implementation doesn't match
const _typeCheck: UserRpcController = new UserRpcControllerImpl();

// Or use a more explicit type assertion
class UserRpcControllerImpl implements UserRpcController {
    // TypeScript will enforce that all interface methods are implemented
    // with the correct signatures
}
```

## Shared Types

Define shared types that are used across interfaces:

```typescript
// shared/types.ts
import { entity } from '@deepkit/type';

@entity.name('user')
export class User {
    constructor(
        public id: number,
        public name: string,
        public email: string,
        public createdAt: Date = new Date()
    ) {}
}

@entity.name('create-user-data')
export class CreateUserData {
    constructor(
        public name: string,
        public email: string,
        public password: string
    ) {}
}

@entity.name('user-filters')
export class UserFilters {
    name?: string;
    email?: string;
    createdAfter?: Date;
    createdBefore?: Date;
    limit?: number;
    offset?: number;
}
```

## Error Handling in Interfaces

Define custom errors in your interfaces:

```typescript
// shared/errors.ts
import { entity } from '@deepkit/type';

@entity.name('@error:user-not-found')
export class UserNotFoundError extends Error {
    constructor(public userId: number) {
        super(`User with ID ${userId} not found`);
    }
}

@entity.name('@error:validation-error')
export class ValidationError extends Error {
    constructor(public field: string, public message: string) {
        super(`Validation failed for ${field}: ${message}`);
    }
}

// Use in interface
interface UserRpcController {
    getUser(id: number): Promise<User>; // Can throw UserNotFoundError
    createUser(userData: CreateUserData): Promise<User>; // Can throw ValidationError
}
```

Client error handling:

```typescript
try {
    const user = await userController.getUser(999);
} catch (error) {
    if (error instanceof UserNotFoundError) {
        console.log('User not found:', error.userId);
    } else if (error instanceof ValidationError) {
        console.log('Validation error:', error.field, error.message);
    } else {
        console.error('Unexpected error:', error);
    }
}
```

## Framework Integration

Use interfaces with the Deepkit Framework:

```typescript
// app.ts
import { App } from '@deepkit/app';
import { FrameworkModule } from '@deepkit/framework';

const app = new App({
    controllers: [
        UserRpcControllerImpl,
        ProductRpcControllerImpl,
        OrderRpcControllerImpl,
        ChatRpcControllerImpl
    ],
    imports: [new FrameworkModule()]
});

app.run();
```

## Testing with Interfaces

Test your implementations using the interfaces:

```typescript
// tests/user.controller.spec.ts
import { createTestingApp } from '@deepkit/framework';
import { UserRpcInterface, UserRpcController } from '../shared/interfaces.js';

test('user controller', async () => {
    const testing = createTestingApp({
        controllers: [UserRpcControllerImpl],
        providers: [UserService]
    });

    await testing.startServer();

    const client = testing.createRpcClient();
    const userController = client.controller<UserRpcController>(UserRpcInterface);

    // Test with full type safety
    const user = await userController.createUser({
        name: 'Test User',
        email: 'test@example.com',
        password: 'password123'
    });

    expect(user.name).toBe('Test User');
    expect(user.email).toBe('test@example.com');

    await testing.stopServer();
});
```

## Benefits of RPC Interfaces

1. **Type Safety**: Full TypeScript type checking between client and server
2. **Contract Definition**: Clear API contracts that both sides must follow
3. **Refactoring Safety**: Changes to interfaces are caught at compile time
4. **IDE Support**: Full IntelliSense and auto-completion
5. **Documentation**: Interfaces serve as living documentation
6. **Testing**: Easy to mock and test with known interfaces
7. **Team Collaboration**: Clear boundaries between frontend and backend teams

## Best Practices

1. **Keep interfaces in shared packages** that both client and server can import
2. **Use meaningful names** for controller symbols
3. **Version your interfaces** when making breaking changes
4. **Document complex methods** with JSDoc comments
5. **Use entity decorators** for all data types
6. **Handle errors explicitly** in interface definitions
7. **Test interface implementations** thoroughly
