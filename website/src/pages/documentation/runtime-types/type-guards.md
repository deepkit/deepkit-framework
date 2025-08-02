# Type Guards and Assertions

Type guards and assertions are essential tools for runtime type checking in TypeScript. Deepkit provides powerful functions that not only check types at runtime but also provide TypeScript with the necessary type information for proper type narrowing.

## Type Guards with `is`

The `is` function is a type guard that returns `true` if the value matches the specified type, and `false` otherwise. When used in conditional statements, TypeScript automatically narrows the type.

### Basic Type Guards

```typescript
import { is } from '@deepkit/type';

function processValue(value: unknown) {
    if (is<string>(value)) {
        // TypeScript knows value is string here
        console.log(value.toUpperCase());
    }
    
    if (is<number>(value)) {
        // TypeScript knows value is number here
        console.log(value.toFixed(2));
    }
}

processValue('hello'); // Outputs: HELLO
processValue(42.567);  // Outputs: 42.57
```

### Complex Type Guards

Type guards work with any TypeScript type, including interfaces, classes, and complex nested structures:

```typescript
import { is, Email, MinLength } from '@deepkit/type';

interface User {
    id: number;
    email: string & Email;
    username: string & MinLength<3>;
    profile?: {
        firstName: string;
        lastName: string;
        age: number;
    };
}

function handleUserData(data: unknown) {
    if (is<User>(data)) {
        // TypeScript knows data is User here
        console.log(`User: ${data.username} (${data.email})`);
        
        if (data.profile) {
            console.log(`Name: ${data.profile.firstName} ${data.profile.lastName}`);
        }
    } else {
        console.log('Invalid user data');
    }
}

// Valid user data
handleUserData({
    id: 1,
    email: 'john@example.com',
    username: 'john_doe',
    profile: {
        firstName: 'John',
        lastName: 'Doe',
        age: 30
    }
});

// Invalid user data
handleUserData({
    id: 1,
    email: 'invalid-email', // Fails Email validation
    username: 'jo'          // Fails MinLength<3> validation
});
```

### Enum Type Guards

Type guards work seamlessly with TypeScript enums:

```typescript
import { is } from '@deepkit/type';

enum UserRole {
    ADMIN = 'admin',
    USER = 'user',
    MODERATOR = 'moderator'
}

enum Status {
    ACTIVE,
    INACTIVE,
    PENDING
}

function checkRole(value: unknown) {
    if (is<UserRole>(value)) {
        console.log(`Valid role: ${value}`);
        return value;
    }
    throw new Error('Invalid role');
}

function checkStatus(value: unknown) {
    if (is<Status>(value)) {
        console.log(`Valid status: ${Status[value]}`);
        return value;
    }
    throw new Error('Invalid status');
}

checkRole('admin');     // Valid
checkRole('invalid');   // Throws error

checkStatus(0);         // Valid (ACTIVE)
checkStatus(3);         // Throws error
```

## Type Assertions with `assert`

The `assert` function throws an error if the value doesn't match the specified type. It's useful when you want to ensure type safety and fail fast on invalid data.

### Basic Assertions

```typescript
import { assert } from '@deepkit/type';

function processUser(userData: unknown) {
    // Throws error if userData is not a valid User
    assert<User>(userData);
    
    // TypeScript knows userData is User from this point
    console.log(`Processing user: ${userData.username}`);
    return userData;
}

try {
    processUser({
        id: 1,
        email: 'john@example.com',
        username: 'john_doe'
    });
} catch (error) {
    console.error('Invalid user data:', error.message);
}
```

### Assertion with Custom Error Messages

```typescript
import { assert, ValidationError } from '@deepkit/type';

function validateApiResponse(response: unknown) {
    try {
        assert<{
            success: boolean;
            data: any;
            message?: string;
        }>(response);
        
        return response;
    } catch (error) {
        if (error instanceof ValidationError) {
            throw new Error(`API response validation failed: ${error.message}`);
        }
        throw error;
    }
}
```

## Advanced Type Guard Patterns

### Union Type Guards

Type guards can distinguish between union types:

```typescript
import { is } from '@deepkit/type';

type ApiResponse = 
    | { success: true; data: any }
    | { success: false; error: string };

function handleResponse(response: unknown) {
    if (is<ApiResponse>(response)) {
        if (response.success) {
            // TypeScript knows this is the success case
            console.log('Data:', response.data);
        } else {
            // TypeScript knows this is the error case
            console.error('Error:', response.error);
        }
    }
}
```

### Generic Type Guards

You can create reusable type guard functions:

```typescript
import { is } from '@deepkit/type';

function isArrayOf<T>(value: unknown, itemGuard: (item: unknown) => item is T): value is T[] {
    return Array.isArray(value) && value.every(itemGuard);
}

// Usage with primitive types
function isStringArray(value: unknown): value is string[] {
    return isArrayOf(value, (item): item is string => is<string>(item));
}

// Usage with complex types
interface Product {
    id: number;
    name: string;
    price: number;
}

function isProductArray(value: unknown): value is Product[] {
    return isArrayOf(value, (item): item is Product => is<Product>(item));
}

const data: unknown = [
    { id: 1, name: 'Laptop', price: 999 },
    { id: 2, name: 'Mouse', price: 25 }
];

if (isProductArray(data)) {
    // TypeScript knows data is Product[]
    data.forEach(product => {
        console.log(`${product.name}: $${product.price}`);
    });
}
```

## Performance Considerations

Type guards and assertions are highly optimized in Deepkit:

- **JIT Compilation**: Type checking functions are compiled just-in-time for maximum performance
- **Caching**: Type information is cached to avoid recompilation
- **Minimal Overhead**: Runtime checks add minimal performance overhead

```typescript
import { is } from '@deepkit/type';

// This is very fast - the type check is compiled once and cached
const isUser = (value: unknown): value is User => is<User>(value);

// Use the cached type guard in performance-critical code
function processUsers(users: unknown[]) {
    return users.filter(isUser).map(user => ({
        id: user.id,
        displayName: user.username
    }));
}
```

## Best Practices

1. **Use Type Guards for Unknown Data**: Always use type guards when dealing with data from external sources (APIs, user input, files).

2. **Prefer `is` for Conditional Logic**: Use `is` when you need to handle both valid and invalid cases.

3. **Use `assert` for Fail-Fast Behavior**: Use `assert` when invalid data should cause the program to stop.

4. **Combine with Validation**: For user-facing applications, combine type guards with the validation system for better error messages.

```typescript
import { is, validate } from '@deepkit/type';

function safeProcessUser(userData: unknown) {
    // Quick type check first
    if (!is<User>(userData)) {
        return { success: false, error: 'Invalid user data structure' };
    }
    
    // Detailed validation for user feedback
    const errors = validate<User>(userData);
    if (errors.length > 0) {
        return { 
            success: false, 
            error: 'Validation failed',
            details: errors 
        };
    }
    
    return { success: true, user: userData };
}
```
