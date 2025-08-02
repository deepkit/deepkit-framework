# Troubleshooting

This guide helps you diagnose and fix common issues when working with Deepkit App.

## Common Issues

### Type Compiler Issues

**Problem**: Runtime types not working, getting `undefined` for type information.

**Symptoms**:
```typescript
// This doesn't work as expected
app.command('test', (name: string) => {
    // Type information is lost at runtime
});
```

**Solution**: Ensure the Deepkit type compiler is properly installed and configured.

1. Install the type compiler:
```bash
npm install @deepkit/type-compiler
./node_modules/.bin/deepkit-type-install
```

2. Configure `tsconfig.json`:
```json
{
    "compilerOptions": {
        "experimentalDecorators": true,
        "emitDecoratorMetadata": true
    },
    "reflection": true
}
```

3. Verify installation:
```bash
# Check if the compiler is installed
ls node_modules/typescript/lib/deepkit*
```

### Dependency Injection Errors

**Problem**: `Service 'X' not found` or circular dependency errors.

**Symptoms**:
```
Error: Service 'UserService' not found. Make sure it's provided in the module.
```

**Solutions**:

1. **Missing Provider**: Ensure the service is registered:
```typescript
// Wrong
const app = new App({
    controllers: [UserController] // UserService not provided
});

// Correct
const app = new App({
    controllers: [UserController],
    providers: [UserService] // Add the service
});
```

2. **Circular Dependencies**: Refactor to break the cycle:
```typescript
// Wrong - circular dependency
class UserService {
    constructor(private orderService: OrderService) {}
}

class OrderService {
    constructor(private userService: UserService) {}
}

// Correct - use a shared service or event system
class UserService {
    constructor(private eventDispatcher: EventDispatcher) {}
    
    createUser(userData: any) {
        const user = new User(userData);
        this.eventDispatcher.dispatch(UserCreated, user);
        return user;
    }
}

class OrderService {
    @eventDispatcher.listen(UserCreated)
    onUserCreated(event: any) {
        // Handle user creation
    }
}
```

3. **Wrong Module Scope**: Ensure services are exported from modules:
```typescript
// Wrong
export class MyModule extends createModuleClass({
    providers: [MyService] // Not exported
}) {}

// Correct
export class MyModule extends createModuleClass({
    providers: [MyService],
    exports: [MyService] // Export for other modules
}) {}
```

### Configuration Issues

**Problem**: Configuration not loading or validation errors.

**Symptoms**:
```
ConfigurationValidationError: Invalid value for 'port': abc. Cannot convert abc to number
```

**Solutions**:

1. **Environment Variable Naming**: Check the naming convention:
```bash
# Wrong
export PORT=3000

# Correct (with default APP_ prefix)
export APP_PORT=3000

# Or configure custom prefix
app.loadConfigFromEnv({ prefix: 'MYAPP_' });
export MYAPP_PORT=3000
```

2. **Type Validation**: Ensure environment values match expected types:
```typescript
class Config {
    port: number = 3000; // Expects number
    debug: boolean = false; // Expects boolean
}

// Environment variables are strings, so:
export APP_PORT=3000      # ✓ Can be converted to number
export APP_DEBUG=true     # ✓ Can be converted to boolean
export APP_DEBUG=1        # ✓ Also works for boolean
```

3. **Missing Required Fields**: Provide required configuration:
```typescript
class Config {
    databaseUrl!: string; // Required field
}

// Must provide via environment or configure()
export APP_DATABASE_URL="sqlite://memory"
# or
app.configure({ databaseUrl: 'sqlite://memory' });
```

### Command Line Parsing Issues

**Problem**: Arguments not parsed correctly or validation errors.

**Symptoms**:
```
Invalid value for argument name: undefined
RequiredArgsError: Missing 1 required arg: name
```

**Solutions**:

1. **Argument Order**: Ensure arguments are in the correct order:
```typescript
// Command definition
app.command('greet', (firstName: string, lastName: string) => {
    console.log(`Hello ${firstName} ${lastName}`);
});

// Correct usage
$ ts-node app.ts greet John Doe

// Wrong - arguments in wrong order
$ ts-node app.ts greet Doe John
```

2. **Optional vs Required**: Use proper TypeScript syntax:
```typescript
// Wrong - all required
app.command('greet', (name: string, age: number) => {});

// Correct - age is optional
app.command('greet', (name: string, age?: number) => {});
// or with default
app.command('greet', (name: string, age: number = 25) => {});
```

3. **Flag vs Argument**: Understand the difference:
```typescript
// Arguments (positional)
app.command('greet', (name: string) => {});
// Usage: ts-node app.ts greet John

// Flags (named)
app.command('greet', (name: string & Flag) => {});
// Usage: ts-node app.ts greet --name John
```

### Module Loading Issues

**Problem**: Modules not loading or processing in wrong order.

**Symptoms**:
```
Error: Cannot find module './my-module'
Module 'X' processed before its dependency 'Y'
```

**Solutions**:

1. **Import Paths**: Use correct relative or absolute paths:
```typescript
// Wrong
import { MyModule } from 'my-module';

// Correct
import { MyModule } from './modules/my-module';
// or
import { MyModule } from '../shared/my-module';
```

2. **Module Dependencies**: Ensure proper import order:
```typescript
// Wrong - UserModule depends on DatabaseModule but imports it after
class UserModule extends createModuleClass({
    providers: [UserService] // UserService needs DatabaseService
}) {
    imports = [new DatabaseModule()]; // Too late
}

// Correct - import dependencies first
class UserModule extends createModuleClass({
    imports: [new DatabaseModule()], // Import first
    providers: [UserService]
}) {}
```

### Performance Issues

**Problem**: Slow startup or command execution.

**Symptoms**:
- Long delays before commands execute
- High memory usage
- Slow dependency injection

**Solutions**:

1. **Lazy Loading**: Avoid expensive operations in constructors:
```typescript
// Wrong - expensive operation in constructor
class ExpensiveService {
    constructor() {
        this.loadLargeDataset(); // Blocks startup
    }
}

// Correct - lazy initialization
class ExpensiveService {
    private initialized = false;
    
    async initialize() {
        if (!this.initialized) {
            await this.loadLargeDataset();
            this.initialized = true;
        }
    }
    
    async doWork() {
        await this.initialize();
        // Work here
    }
}
```

2. **Service Scopes**: Use appropriate scopes:
```typescript
// Wrong - creates new instance every time
{ provide: HeavyService, scope: Scope.transient }

// Correct - reuse instance
{ provide: HeavyService } // Default: singleton
```

3. **Module Optimization**: Avoid unnecessary imports:
```typescript
// Wrong - imports everything
import * as deepkit from '@deepkit/framework';

// Correct - import only what you need
import { App } from '@deepkit/app';
import { Logger } from '@deepkit/logger';
```

## Debugging Techniques

### Enable Debug Logging

Add debug logging to understand what's happening:

```typescript
import { Logger } from '@deepkit/logger';

const app = new App({
    providers: [
        { 
            provide: Logger, 
            useValue: new Logger([new ConsoleTransport()], 5) // Debug level
        }
    ]
});
```

### Inspect Service Container

Check what services are registered:

```typescript
const app = new App({
    providers: [MyService]
});

// After app is built, inspect the container
console.log('Registered providers:', app.serviceContainer.getProviders());
```

### Use TypeScript Strict Mode

Enable strict TypeScript checking to catch issues early:

```json
{
    "compilerOptions": {
        "strict": true,
        "noImplicitAny": true,
        "strictNullChecks": true,
        "strictFunctionTypes": true
    }
}
```

### Test Individual Components

Isolate issues by testing components individually:

```typescript
// Test service directly
const service = new MyService(mockDependency);
const result = service.doSomething();

// Test with DI container
const testing = createTestingApp({
    providers: [MyService, MyDependency]
});
const service = testing.app.get(MyService);
```

## Common Error Messages

### `Cannot resolve dependency`

**Error**: `Cannot resolve dependency 'X' of 'Y'`

**Cause**: Missing provider or circular dependency

**Fix**: 
1. Add the missing provider to your module
2. Check for circular dependencies
3. Ensure the dependency is exported from its module

### `Invalid configuration`

**Error**: `ConfigurationValidationError: Invalid value for 'field'`

**Cause**: Configuration value doesn't match expected type or constraints

**Fix**:
1. Check environment variable values
2. Verify type constraints in configuration class
3. Use proper type conversion

### `Command not found`

**Error**: `Command 'X' not found`

**Cause**: Command not registered or wrong name

**Fix**:
1. Ensure command is registered with `app.command()` or controller
2. Check command name spelling
3. Verify controller is in the `controllers` array

### `Module not found`

**Error**: `Cannot find module 'X'`

**Cause**: Incorrect import path or missing dependency

**Fix**:
1. Check import paths are correct
2. Ensure npm package is installed
3. Verify file exists at specified path

## Getting Help

### Enable Verbose Output

Use the `--help` flag to see available commands and options:

```bash
ts-node app.ts --help
ts-node app.ts command-name --help
```

### Check Version Compatibility

Ensure all Deepkit packages are compatible versions:

```bash
npm list @deepkit/app @deepkit/type @deepkit/injector
```

### Community Resources

- [GitHub Issues](https://github.com/deepkit/deepkit-framework/issues)
- [Discord Community](https://discord.gg/deepkit)
- [Documentation](https://deepkit.io/documentation)

### Creating Minimal Reproduction

When reporting issues, create a minimal example:

```typescript
// minimal-repro.ts
import { App } from '@deepkit/app';

const app = new App({});

app.command('test', () => {
    console.log('This should work but doesn\'t');
});

app.run();
```

This helps maintainers understand and fix issues quickly.
