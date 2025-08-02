# Error Handling and Debugging

Deepkit's dependency injection system provides comprehensive error detection and helpful debugging information to help you identify and resolve issues quickly.

## Common Errors

### Undefined Dependencies

When a dependency cannot be resolved, Deepkit provides detailed error messages:

```typescript
class Database {
    constructor(private config: DatabaseConfig) {} // DatabaseConfig not provided
}

class UserService {
    constructor(private db: Database) {}
}

const injector = Injector.from([UserService, Database]);
// Error: Undefined dependency "config: DatabaseConfig" of Database(?)
```

**Solution**: Ensure all dependencies are provided:

```typescript
const injector = Injector.from([
    UserService, 
    Database, 
    DatabaseConfig  // Add missing dependency
]);
```

### Circular Dependencies

Deepkit automatically detects circular dependencies:

```typescript
class ServiceA {
    constructor(private serviceB: ServiceB) {}
}

class ServiceB {
    constructor(private serviceA: ServiceA) {}
}

const injector = Injector.from([ServiceA, ServiceB]);
// Error: Circular dependency found ServiceA -> ServiceB -> ServiceA
```

**Solutions**:

1. **Redesign**: Extract shared logic into a third service
2. **Property Injection**: Break the cycle with property injection
3. **Factory Pattern**: Use a factory to defer instantiation

```typescript
// Solution 1: Extract shared logic
class SharedService {}

class ServiceA {
    constructor(private shared: SharedService) {}
}

class ServiceB {
    constructor(private shared: SharedService) {}
}

// Solution 2: Property injection
class ServiceA {
    private serviceB!: Inject<ServiceB>;
    
    constructor() {}
}

class ServiceB {
    constructor(private serviceA: ServiceA) {}
}
```

### Scope Errors

Attempting to access scoped providers from the wrong scope:

```typescript
class UserSession {}

const injector = InjectorContext.forProviders([
    { provide: UserSession, scope: 'http' }
]);

// Error: Service 'UserSession' is known but is not available in scope global
const session = injector.get(UserSession);
```

**Solution**: Use the correct scope:

```typescript
const httpScope = injector.createChildScope('http');
const session = httpScope.get(UserSession); // Works
```

### Type Errors

When TypeScript types don't match runtime expectations:

```typescript
class Service {
    constructor(private value: any) {} // 'any' type is problematic
}

const injector = Injector.from([Service]);
// Error: Undefined dependency "value: any" of Service(?)
```

**Solution**: Use specific types or provide explicit values:

```typescript
class Service {
    constructor(private value: string) {}
}

const injector = Injector.from([
    Service,
    { provide: 'string', useValue: 'hello' }
]);
```

## Debugging Techniques

### Inspecting the Dependency Graph

Use the injector's built-in methods to understand the dependency structure:

```typescript
const injector = Injector.from([UserService, Database, Logger]);

// Check if a provider is available
console.log(injector.has(UserService)); // true
console.log(injector.has(UnknownService)); // false

// Get provider information
const userService = injector.get(UserService);
console.log(userService.constructor.name); // 'UserService'
```

### Module Inspection

For complex module hierarchies, inspect module structure:

```typescript
const rootModule = new InjectorModule([UserService]);
const dbModule = new InjectorModule([Database]).setParent(rootModule);

// Check if a module provides a service
console.log(rootModule.isProvided(UserService)); // true
console.log(dbModule.isProvided(Database)); // true

// Check exports
console.log(dbModule.isExported(Database)); // false (not exported)
```

### Debugging Scopes

When working with scopes, verify scope configuration:

```typescript
const injector = InjectorContext.forProviders([
    { provide: UserSession, scope: 'http' },
    { provide: Logger, scope: 'http' }
]);

// Create scope and inspect
const scope = injector.createChildScope('http');
console.log(scope.scope.name); // 'http'

// Check what's available in scope
const session = scope.get(UserSession);
console.log(session instanceof UserSession); // true
```

## Error Prevention

### Use TypeScript Strictly

Enable strict TypeScript settings to catch issues early:

```json
// tsconfig.json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true
  }
}
```

### Explicit Provider Configuration

Be explicit about provider configuration to avoid ambiguity:

```typescript
// Good: Explicit configuration
const injector = Injector.from([
    { provide: UserService, useClass: UserService },
    { provide: Database, useClass: PostgresDatabase },
    { provide: 'api.key', useValue: process.env.API_KEY }
]);

// Less clear: Implicit configuration
const injector = Injector.from([UserService, Database]);
```

### Validate Configuration Early

Use configuration validation to catch errors at startup:

```typescript
class AppConfig {
    port!: number & Positive;
    host!: string & MinLength<1>;
}

// This will throw if configuration is invalid
const module = new InjectorModule([])
    .setConfigDefinition(AppConfig)
    .configure({
        port: -1,  // Invalid: not positive
        host: ''   // Invalid: too short
    });
```

## Testing and Debugging

### Unit Testing with Mocks

Create test-specific injectors with mocked dependencies:

```typescript
// Production
class UserService {
    constructor(private db: Database) {}
}

// Test
class MockDatabase {
    findUser() { return { id: 1, name: 'Test User' }; }
}

const testInjector = Injector.from([
    { provide: Database, useClass: MockDatabase },
    UserService
]);

const userService = testInjector.get(UserService);
// userService now uses MockDatabase
```

### Integration Testing

Test module integration:

```typescript
const testModule = new InjectorModule([
    UserService,
    { provide: Database, useValue: mockDatabase },
    { provide: Logger, useValue: mockLogger }
]);

const injector = new InjectorContext(testModule);
const userService = injector.get(UserService);

// Test that all dependencies are properly injected
expect(userService).toBeDefined();
```

## Performance Debugging

### Identifying Expensive Dependencies

Monitor dependency creation performance:

```typescript
class ExpensiveService {
    constructor() {
        console.time('ExpensiveService creation');
        // Expensive initialization
        console.timeEnd('ExpensiveService creation');
    }
}

// Use transient if you suspect singleton caching issues
const injector = Injector.from([
    { provide: ExpensiveService, transient: true }
]);
```

### Memory Leak Detection

Monitor scope cleanup:

```typescript
const injector = InjectorContext.forProviders([
    { provide: UserSession, scope: 'http' }
]);

// Create many scopes
for (let i = 0; i < 1000; i++) {
    const scope = injector.createChildScope('http');
    const session = scope.get(UserSession);
    // Scope should be garbage collected when it goes out of scope
}
```

## Best Practices for Debugging

1. **Use Descriptive Names**: Clear class and property names help with error messages
2. **Fail Fast**: Validate dependencies at startup, not at runtime
3. **Log Dependency Creation**: Add logging to constructors during debugging
4. **Test Module Boundaries**: Ensure imports/exports work as expected
5. **Use Development Tools**: Leverage TypeScript's compiler and IDE features

```typescript
// Good: Clear, debuggable code
class UserNotificationService {
    constructor(
        private emailService: EmailService,
        private smsService: SmsService,
        private logger: Logger
    ) {
        this.logger.log('UserNotificationService initialized');
    }
}

// Less ideal: Unclear dependencies
class Service {
    constructor(private a: any, private b: any) {}
}
```
