# Application Lifecycle

Understanding the Deepkit App lifecycle is crucial for building robust applications. This chapter covers the startup process, lifecycle events, error handling, and shutdown procedures.

## Application Startup Process

When you call `app.run()` or `app.execute()`, Deepkit follows a specific sequence:

1. **Module Discovery**: Find all modules starting from the root module
2. **Configuration Loading**: Load and validate configuration from all sources
3. **Service Container Building**: Build the dependency injection container
4. **Bootstrap**: Execute bootstrap hooks and initialize services
5. **Command Execution**: Parse arguments and execute the requested command
6. **Shutdown**: Clean up resources and exit

### Detailed Startup Sequence

```typescript
import { App, onAppExecute, onAppExecuted, onAppError, onAppShutdown } from '@deepkit/app';

const app = new App({
    providers: [MyService]
});

// These events fire during the lifecycle
app.listen(onAppExecute, (event) => {
    console.log('About to execute command:', event.command);
});

app.listen(onAppExecuted, (event) => {
    console.log('Command executed with exit code:', event.exitCode);
});

app.listen(onAppError, (event) => {
    console.log('Command failed with error:', event.error.message);
});

app.listen(onAppShutdown, () => {
    console.log('Application is shutting down');
});

app.run();
```

## Module Processing Order

Modules are processed in a specific order to ensure dependencies are resolved correctly:

```typescript
import { createModuleClass } from '@deepkit/app';

class DatabaseModule extends createModuleClass({
    providers: [DatabaseService]
}) {
    process() {
        console.log('1. DatabaseModule.process()');
    }
    
    postProcess() {
        console.log('4. DatabaseModule.postProcess()');
    }
}

class UserModule extends createModuleClass({
    imports: [new DatabaseModule()],
    providers: [UserService]
}) {
    process() {
        console.log('2. UserModule.process()');
    }
    
    postProcess() {
        console.log('5. UserModule.postProcess()');
    }
}

const app = new App({
    imports: [new UserModule()]
});

// Processing order:
// 1. DatabaseModule.process()
// 2. UserModule.process()  
// 3. Service container built
// 4. DatabaseModule.postProcess()
// 5. UserModule.postProcess()
```

## Configuration Lifecycle

Configuration is loaded and validated before services are instantiated:

```typescript
class AppConfig {
    databaseUrl: string = 'sqlite://memory';
    debug: boolean = false;
}

class DatabaseService {
    constructor(private databaseUrl: AppConfig['databaseUrl']) {
        // Configuration is guaranteed to be loaded and validated here
        console.log('Connecting to:', this.databaseUrl);
    }
}

const app = new App({
    config: AppConfig,
    providers: [DatabaseService]
})
.loadConfigFromEnv() // Loads before service instantiation
.configure({ debug: true }); // Also loads before service instantiation
```

## Service Instantiation

Services are instantiated lazily when first requested:

```typescript
class ExpensiveService {
    constructor() {
        console.log('ExpensiveService instantiated');
        // This only runs when the service is first requested
    }
}

class UserService {
    constructor(private expensiveService: ExpensiveService) {
        // ExpensiveService is instantiated here when UserService is created
    }
}

const app = new App({
    providers: [ExpensiveService, UserService]
});

// Services are not instantiated yet
console.log('App created');

// UserService (and ExpensiveService) instantiated here
const userService = app.get(UserService);
```

## Scoped Services

Different scopes have different lifecycles:

```typescript
import { Scope } from '@deepkit/injector';

class SingletonService {
    // Default scope - one instance per module
}

class TransientService {
    // New instance every time it's requested
}

class CliService {
    // One instance per CLI command execution
}

const app = new App({
    providers: [
        SingletonService, // Default: singleton
        { provide: TransientService, scope: Scope.transient },
        { provide: CliService, scope: 'cli' }
    ]
});
```

## Error Handling

Handle errors at different stages of the lifecycle:

```typescript
import { onAppError } from '@deepkit/app';

class ErrorProneService {
    constructor() {
        // Errors here are caught during service instantiation
        throw new Error('Service initialization failed');
    }
}

const app = new App({
    providers: [ErrorProneService]
});

// Global error handler
app.listen(onAppError, (event, logger: Logger) => {
    logger.error('Application error:', event.error);
    
    // You can modify the exit code
    if (event.error.message.includes('critical')) {
        return 1; // Exit with error code 1
    }
});

// Command-specific error handling
app.command('risky', () => {
    throw new Error('Something went wrong');
});

app.run();
```

## Graceful Shutdown

Handle cleanup when the application shuts down:

```typescript
import { onAppShutdown } from '@deepkit/app';

class DatabaseService {
    private connection: any;
    
    constructor() {
        this.connection = createConnection();
    }
    
    async close() {
        await this.connection.close();
    }
}

const app = new App({
    providers: [DatabaseService]
});

// Register shutdown handler
app.listen(onAppShutdown, async (event, db: DatabaseService) => {
    console.log('Closing database connection...');
    await db.close();
});

// Handle process signals
if (typeof process !== 'undefined') {
    process.on('SIGINT', async () => {
        console.log('Received SIGINT, shutting down gracefully...');
        await app.dispatch(onAppShutdown);
        process.exit(0);
    });
}
```

## Bootstrap Hooks

Use bootstrap hooks to initialize services after the container is built:

```typescript
class CacheService {
    private cache = new Map();
    
    async initialize() {
        // Load initial cache data
        console.log('Initializing cache...');
    }
}

class AppModule extends createModuleClass({
    providers: [CacheService]
}) {
    async bootstrap(cache: CacheService) {
        // Called after all modules are processed
        await cache.initialize();
    }
}

const app = App.fromModule(new AppModule());
```

## Setup Hooks

Use setup hooks to configure the application before services are built:

```typescript
const app = new App({
    providers: [DatabaseService]
})
.setup((module, config) => {
    // Called after configuration is loaded but before services are built
    if (config.debug) {
        module.addProvider(DebugService);
    }
    
    // Configure existing providers
    module.configureProvider<DatabaseService>(db => {
        db.setConnectionPool(config.maxConnections);
    });
});
```

## Command Execution Lifecycle

Each command execution follows its own lifecycle:

```typescript
app.command('deploy', async (environment: string, logger: Logger) => {
    logger.log('Starting deployment to', environment);
    
    try {
        // Command logic here
        await deployToEnvironment(environment);
        logger.log('Deployment successful');
        return 0; // Success exit code
    } catch (error) {
        logger.error('Deployment failed:', error);
        return 1; // Error exit code
    }
});
```

## Lifecycle Events Summary

| Event | When | Use Case |
|-------|------|----------|
| `onAppExecute` | Before command execution | Logging, setup |
| `onAppExecuted` | After successful command | Cleanup, metrics |
| `onAppError` | When command fails | Error handling, logging |
| `onAppShutdown` | Application shutdown | Resource cleanup |

## Best Practices

1. **Use lifecycle events for cross-cutting concerns**: Logging, metrics, cleanup
2. **Handle errors gracefully**: Provide meaningful error messages and appropriate exit codes
3. **Clean up resources**: Use shutdown handlers to close connections and free resources
4. **Lazy initialization**: Services are instantiated when needed, not at startup
5. **Configuration validation**: Validate configuration early in the lifecycle
6. **Scoped services appropriately**: Use the right scope for your service's lifecycle needs

```typescript
// Good: Proper lifecycle management
class FileService {
    private fileHandle?: FileHandle;
    
    async openFile(path: string) {
        this.fileHandle = await open(path);
    }
    
    async close() {
        if (this.fileHandle) {
            await this.fileHandle.close();
        }
    }
}

const app = new App({ providers: [FileService] });

app.listen(onAppShutdown, async (event, fileService: FileService) => {
    await fileService.close();
});
```
