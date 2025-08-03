# Configuration

Deepkit's dependency injection system provides a powerful, type-safe configuration system that allows you to inject configuration values directly into your services. Configuration is defined using regular TypeScript classes, providing both type safety and default values.

## Configuration Classes

Configuration is defined using classes where each property represents a configuration option:

```typescript
class DatabaseConfig {
    host: string = 'localhost';
    port: number = 5432;
    username: string = 'admin';
    password!: string;  // Required - no default value
    ssl: boolean = false;
    maxConnections: number = 10;
}

class AppConfig {
    debug: boolean = false;
    apiUrl: string = 'https://api.example.com';
    database: DatabaseConfig = new DatabaseConfig();
}

const rootModule = new InjectorModule([UserRepository])
    .setConfigDefinition(AppConfig);
```

**Benefits of Class-based Configuration:**
- **Type Safety**: Full TypeScript type checking
- **Default Values**: Specify defaults directly in the class
- **Nested Configuration**: Use composition for complex config structures
- **IDE Support**: Autocomplete and refactoring support

## Injecting Configuration

Configuration can be injected in several ways:

### Single Property Injection

Inject individual configuration properties using index access:

```typescript
class UserRepository {
    constructor(
        private debug: AppConfig['debug'],
        private dbHost: AppConfig['database']['host']
    ) {}

    getUsers() {
        if (this.debug) {
            console.debug(`Fetching users from ${this.dbHost}`);
        }
        // ...
    }
}
```

### Partial Configuration Injection

Inject multiple related properties using `Pick`:

```typescript
class EmailService {
    constructor(
        private config: Pick<AppConfig, 'debug' | 'apiUrl'>
    ) {}

    sendEmail(to: string, subject: string) {
        if (this.config.debug) {
            console.log(`Would send email to ${to}: ${subject}`);
            return;
        }

        // Use this.config.apiUrl for actual sending
    }
}
```

### Full Configuration Injection

Inject the entire configuration object:

```typescript
class ApplicationService {
    constructor(private config: AppConfig) {}

    initialize() {
        console.log(`Starting app in ${this.config.debug ? 'debug' : 'production'} mode`);
        console.log(`Database: ${this.config.database.host}:${this.config.database.port}`);
    }
}
```

## Setting Configuration Values

Use the `configure()` method to set configuration values:

```typescript
// Set individual values
rootModule.configure({
    debug: true,
    apiUrl: 'https://staging-api.example.com'
});

// Set nested values
rootModule.configure({
    database: {
        host: 'production-db.example.com',
        port: 5432,
        password: 'secure-password',
        ssl: true
    }
});
```

## Required Configuration

Use the `!` operator to mark configuration as required:

```typescript
class SecurityConfig {
    jwtSecret!: string;        // Required
    encryptionKey!: string;    // Required
    sessionTimeout: number = 3600; // Optional with default
}
```

If required configuration is not provided, the injector will throw an error at startup.

## Configuration Validation

Deepkit's configuration system integrates with the type system to provide validation. You can use validation decorators and types to ensure configuration values meet your requirements:

```typescript
import { MinLength, MaxLength, Positive, Email } from '@deepkit/type';

class ServerConfig {
    // String validation
    host!: string & MinLength<1>;

    // Number validation
    port!: number & Positive;

    // Email validation
    adminEmail!: string & Email;

    // Complex validation
    apiKey!: string & MinLength<32> & MaxLength<64>;
}
```

## Environment-based Configuration

Load configuration from environment variables or files:

```typescript
class AppConfig {
    port: number = 3000;
    database: {
        host: string;
        port: number;
    } = {
        host: 'localhost',
        port: 5432
    };
}

// Load from environment
const config = {
    port: parseInt(process.env.PORT || '3000'),
    database: {
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT || '5432')
    }
};

rootModule.configure(config);
```

## Configuration Inheritance

Child modules inherit configuration from parent modules:

```typescript
class GlobalConfig {
    debug: boolean = false;
    apiUrl: string = 'https://api.example.com';
}

class DatabaseConfig {
    host: string = 'localhost';
    port: number = 5432;
}

// Parent module
const rootModule = new InjectorModule([])
    .setConfigDefinition(GlobalConfig);

// Child module inherits GlobalConfig and adds DatabaseConfig
const databaseModule = new InjectorModule([DatabaseService])
    .setConfigDefinition(DatabaseConfig)
    .setParent(rootModule);

// DatabaseService can inject from both configs
class DatabaseService {
    constructor(
        private debug: GlobalConfig['debug'],      // From parent
        private dbHost: DatabaseConfig['host']     // From current module
    ) {}
}
```

## Advanced Configuration Patterns

### Configuration Factories

Use factories for complex configuration logic:

```typescript
class RedisConfig {
    url!: string;
    maxRetries: number = 3;
}

const redisModule = new InjectorModule([
    {
        provide: 'redis.client',
        useFactory: (config: RedisConfig) => {
            return new Redis(config.url, {
                retryDelayOnFailover: 100,
                maxRetriesPerRequest: config.maxRetries
            });
        }
    }
]).setConfigDefinition(RedisConfig);
```

### Configuration Splitting

Split large configurations into focused, reusable pieces:

```typescript
class DatabaseConfig {
    host: string = 'localhost';
    port: number = 5432;
    ssl: boolean = false;
}

class CacheConfig {
    ttl: number = 3600;
    maxSize: number = 1000;
}

class AppConfig {
    debug: boolean = false;
    database: DatabaseConfig = new DatabaseConfig();
    cache: CacheConfig = new CacheConfig();
}

// Services can inject exactly what they need
class CacheService {
    constructor(private config: CacheConfig) {}
}

class DatabaseService {
    constructor(private config: DatabaseConfig) {}
}
```

## Best Practices

1. **Inject Only What You Need**: Use property access (`Config['property']`) rather than full config objects
2. **Use Defaults**: Provide sensible defaults for optional configuration
3. **Validate Early**: Use type validation to catch configuration errors at startup
4. **Environment Separation**: Use different configuration for development, staging, and production
5. **Documentation**: Document configuration options and their effects

```typescript
// Good: Specific injection
class EmailService {
    constructor(private smtpHost: EmailConfig['smtpHost']) {}
}

// Less ideal: Full config injection
class EmailService {
    constructor(private config: EmailConfig) {}
}
```
