# Error Handling

## Understanding RPC Error Handling

Error handling in distributed systems is fundamentally different from local error handling. When an error occurs on the server, it must be serialized, transmitted over the network, and reconstructed on the client while preserving as much context as possible. Deepkit RPC provides sophisticated error handling that maintains error types, messages, stack traces, and custom properties across the network boundary.

### How RPC Errors Work

When an error occurs in a server action:

1. **Error Capture**: The RPC kernel catches the thrown error
2. **Serialization**: Error properties (message, stack, custom fields) are serialized
3. **Type Preservation**: If the error class is registered, its type identity is preserved
4. **Network Transmission**: Serialized error data is sent to the client
5. **Reconstruction**: The client reconstructs the error with its original type and properties
6. **Client Handling**: The client can use `instanceof` checks and access all error properties

### Error Serialization Process

```
Server Side                    Network                     Client Side
┌─────────────┐               ┌─────────┐                ┌─────────────┐
│ throw new   │  serialize    │ BSON    │   deserialize  │ instanceof  │
│ CustomError │ ────────────→ │ Error   │ ─────────────→ │ CustomError │
│             │               │ Data    │                │ === true    │
└─────────────┘               └─────────┘                └─────────────┘
```

## Custom Error Classes

For type-safe error handling, define custom error classes and register them with unique names:

### Basic Custom Error

```typescript
import { entity } from '@deepkit/type';

// Register the error class with a unique name
// The '@error:' prefix is a convention for error types
@entity.name('@error:myError')
class MyError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'MyError';
    }
}
```

### Rich Error Classes

Create errors with additional context and properties:

```typescript
@entity.name('@error:validationError')
class ValidationError extends Error {
    constructor(
        message: string,
        public field: string,
        public value: any,
        public constraints: string[]
    ) {
        super(message);
        this.name = 'ValidationError';
    }
}

@entity.name('@error:notFoundError')
class NotFoundError extends Error {
    constructor(
        public resourceType: string,
        public resourceId: string | number
    ) {
        super(`${resourceType} with ID ${resourceId} not found`);
        this.name = 'NotFoundError';
    }
}

@entity.name('@error:authenticationError')
class AuthenticationError extends Error {
    constructor(
        message: string,
        public code: 'INVALID_CREDENTIALS' | 'TOKEN_EXPIRED' | 'ACCESS_DENIED'
    ) {
        super(message);
        this.name = 'AuthenticationError';
    }
}
```

### Server-Side Error Throwing

```typescript
@rpc.controller('/users')
class UserController {
    constructor(private userService: UserService) {}

    @rpc.action()
    async saveUser(user: CreateUserData): Promise<User> {
        // Validate input
        if (!user.email || !user.email.includes('@')) {
            throw new ValidationError(
                'Invalid email address',
                'email',
                user.email,
                ['must be a valid email address']
            );
        }

        // Check if user already exists
        const existingUser = await this.userService.findByEmail(user.email);
        if (existingUser) {
            throw new ValidationError(
                'Email already in use',
                'email',
                user.email,
                ['must be unique']
            );
        }

        try {
            return await this.userService.create(user);
        } catch (dbError) {
            // Wrap database errors in application errors
            throw new Error(`Failed to save user: ${dbError.message}`);
        }
    }

    @rpc.action()
    async getUser(id: number): Promise<User> {
        const user = await this.userService.findById(id);
        if (!user) {
            throw new NotFoundError('User', id);
        }
        return user;
    }
}
```

### Client-Side Error Handling

```typescript
// Register error classes with the client controller
const controller = client.controller<UserController>('/users', [
    ValidationError,
    NotFoundError,
    AuthenticationError
]);

async function createUser(userData: CreateUserData): Promise<User | null> {
    try {
        const user = await controller.saveUser(userData);
        console.log('User created successfully:', user);
        return user;

    } catch (error) {
        // Handle specific error types
        if (error instanceof ValidationError) {
            console.error(`Validation failed for ${error.field}:`, error.message);
            console.error('Constraints:', error.constraints);
            this.showFieldError(error.field, error.message);

        } else if (error instanceof NotFoundError) {
            console.error(`Resource not found: ${error.resourceType} ${error.resourceId}`);
            this.showNotFoundMessage(error.resourceType);

        } else if (error instanceof AuthenticationError) {
            console.error(`Authentication failed: ${error.code}`);
            if (error.code === 'TOKEN_EXPIRED') {
                this.redirectToLogin();
            }

        } else {
            // Handle unexpected errors
            console.error('Unexpected error:', error.message);
            this.showGenericErrorMessage();
        }

        return null;
    }
}
```

## Transform Error

Since thrown errors are automatically forwarded to the client with all its information like the error message and also the stacktrace, this could unwantedly publish sensitive information. To change this, in the method `transformError` the thrown error can be modified.

```typescript
class MyKernelSecurity extends RpcKernelSecurity {
    constructor(private logger: Logger) {
        super();
    }

    transformError(error: Error) {
        //wrap in new error
        this.logger.error('Error in RPC', error);
        return new Error('Something went wrong: ' + error.message);
    }
}
```

Note that once the error is converted to a generic `error`, the complete stack trace and the identity of the error are lost. Accordingly, no `instanceof` checks can be used on the error in the client.

If Deepkit RPC is used between two microservices, and thus the client and server are under complete control of the developer, then transforming the error is rarely necessary. If, on the other hand, the client is running in a browser with an unknown, then care should be taken in `transformError` as to what information is to be disclosed. If in doubt, each error should be transformed with a generic `Error` to ensure that no internal details are leaked. Logging the error would then be a good idea at this point.
