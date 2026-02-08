# @deepkit/injector Errors

Error codes for the `@deepkit/injector` package follow the format `DK-I###`.

## DK-I001: Injector Error

**Message:** [Injector-specific error message]

**Causes:**
- General dependency injection failure
- Invalid provider configuration
- Module setup issues
- Injector not built before use

**Solution:**
1. Verify provider configuration is correct
2. Ensure all modules are properly imported
3. Check that the injector is built before calling `get()`
4. Review the error message for specific configuration issues

---

## DK-I010: Circular Dependency

**Message:** Circular dependency found [path]

**Causes:**
- Service A depends on Service B, which depends on Service A
- Indirect circular dependency through multiple services
- Circular module imports causing dependency cycles

**Solution:**
1. Identify the circular path from the error message
2. Refactor to break the cycle using one of these patterns:
   - Use lazy injection with factory providers
   - Extract shared functionality into a third service
   - Use the `Inject<() => Type>` pattern for lazy resolution

Example:
```typescript
// Problem: Circular dependency
class ServiceA {
    constructor(private b: ServiceB) {}
}
class ServiceB {
    constructor(private a: ServiceA) {}  // Circular!
}

// Solution 1: Use factory for lazy injection
class ServiceB {
    constructor(private getA: () => ServiceA) {}

    doSomething() {
        const a = this.getA();  // Resolved lazily
    }
}

// Solution 2: Extract common functionality
class SharedService {
    // Common functionality used by both A and B
}
class ServiceA {
    constructor(private shared: SharedService) {}
}
class ServiceB {
    constructor(private shared: SharedService) {}
}
```

---

## DK-I020: Service Not Found

**Message:** Service '[label]' not found. No matching provider.

**Causes:**
- Requesting a service that has no provider registered
- Service is registered in a different scope than requested
- Typo in the service token or class name
- Module containing the provider is not imported

**Solution:**
1. Register a provider for the service in your module
2. Check the service is available in the requested scope
3. Verify the correct token/class is being used
4. Ensure the module with the provider is imported

Example:
```typescript
import { InjectorModule } from '@deepkit/injector';

class MyService {
    doWork() {}
}

// Ensure the service is provided
const module = new InjectorModule([
    MyService,  // Class provider
    // or
    { provide: MyService, useClass: MyService },
]);

const injector = module.build();
const service = injector.get(MyService);  // Now works
```

For scope issues:
```typescript
// Service registered in 'request' scope
{ provide: RequestService, useClass: RequestService, scope: 'request' }

// Must request with correct scope
const service = injector.get(RequestService, requestScope);
```

---

## DK-I030: Dependencies Unmet

**Message:** Unknown [function argument|constructor argument|property parameter] '[name]: [type]' of [target]. Make sure '[type]' is provided.

**Causes:**
- A dependency required by a service is not registered
- Constructor parameter type cannot be resolved
- Factory function parameter is not available
- Optional dependency not marked as optional

**Solution:**
1. Register providers for all dependencies
2. Mark optional dependencies with `?` or use the `Optional` type
3. Ensure type information is available (type-compiler is working)
4. Check that all required services are provided in the correct module

Example:
```typescript
import { InjectorModule } from '@deepkit/injector';

class Logger {}
class Database {}

class UserService {
    constructor(
        private logger: Logger,
        private database: Database,
        private cache?: CacheService,  // Optional dependency
    ) {}
}

// Provide all required dependencies
const module = new InjectorModule([
    Logger,
    Database,
    UserService,
    // CacheService is optional, so it doesn't need to be provided
]);
```

For factory providers:
```typescript
{
    provide: MyService,
    useFactory: (logger: Logger, config: Config) => {
        return new MyService(logger, config);
    },
    deps: [Logger, Config],  // Ensure deps are listed
}
```

---

## DK-I040: Invalid Class Provider

**Message:** UseClassProvider needs to set either 'useClass' or 'provide' as a ClassType. Got [value].

**Causes:**
- Providing a class provider without specifying the class
- Using a non-class type where a class is expected
- Invalid provider configuration

**Solution:**
Ensure the provider has a valid class:

```typescript
// Correct: provide is a class
{ provide: MyService, useClass: MyImplementation }

// Correct: provide is a class (shorthand)
MyService  // Equivalent to { provide: MyService, useClass: MyService }

// Wrong: provide is not a class
{ provide: 'myService', useClass: MyService }  // Use proper token instead
```

---

## DK-I050: Injector Not Built

**Message:** Injector was not built. Call build() before using the injector.

**Causes:**
- Calling `get()`, `set()`, or other methods before building the injector
- Forgetting to call `build()` on the module
- Using a module directly instead of its built injector

**Solution:**
Build the injector before using it:

```typescript
const module = new InjectorModule([MyService]);
const injector = module.build();  // Build the injector first

// Now you can use it
const service = injector.get(MyService);
```

---

## DK-I060: No Token Provided

**Message:** No token provided to getResolver().

**Causes:**
- Calling `getResolver()` without specifying a token
- Passing `undefined` or `null` as the token

**Solution:**
Provide a valid token:

```typescript
const resolver = injector.getResolver(MyService);  // Pass the service class/token
```

---

## DK-I070: Invalid Provider

**Message:** Invalid provider. Must be a class, value, factory, or existing provider.

**Causes:**
- Provider configuration doesn't match any known provider type
- Missing required fields in provider object
- Malformed provider definition

**Solution:**
Use one of the valid provider types:

```typescript
// Class provider
{ provide: MyService, useClass: MyImplementation }

// Value provider
{ provide: 'API_URL', useValue: 'https://api.example.com' }

// Factory provider
{ provide: MyService, useFactory: () => new MyService() }

// Existing provider (alias)
{ provide: MyInterface, useExisting: MyImplementation }
```

---

## DK-I080: Undefined ClassType

**Message:** Cannot create factory for undefined ClassType.

**Causes:**
- Internal error where a class type is unexpectedly undefined
- Circular reference causing undefined class resolution
- Type information not available at runtime

**Solution:**
1. Ensure `@deepkit/type-compiler` is properly configured
2. Check for circular dependencies that might cause undefined types
3. Verify the class is properly exported and imported

---

## DK-I090: Transient Injection Target Unavailable

**Message:** Cannot inject TransientInjectionTarget into [service], as [service] is not transient.

**Causes:**
- Trying to inject `TransientInjectionTarget` into a non-transient service
- Missing `transient: true` in the provider configuration

**Solution:**
Mark the service as transient:

```typescript
{
    provide: MyService,
    useClass: MyService,
    transient: true  // Enable transient injection
}
```

---

## DK-I100: Undefined Type for Partial Factory

**Message:** Cannot create partial factory for undefined type.

**Causes:**
- Calling `partialFactory()` with an undefined type
- Type information not available at runtime

**Solution:**
Ensure the type is properly defined and available:

```typescript
const factory = partialFactory<MyService>(typeOf<MyService>(), injector);
```

---

## DK-I101: Unsupported Type for Partial Factory

**Message:** Cannot create partial factory for [type]. Only class and object literal types are supported.

**Causes:**
- Attempting to create a partial factory for a primitive type
- Using unions, intersections, or other complex types
- Type is not a class or object literal

**Solution:**
Use a class or object literal type:

```typescript
// Supported: class type
class MyService {
    constructor(public logger: Logger) {}
}
const factory = partialFactory<MyService>(typeOf<MyService>(), injector);

// Supported: object literal
interface MyConfig {
    apiUrl: string;
}
const factory = partialFactory<MyConfig>(typeOf<MyConfig>(), injector);
```

---
