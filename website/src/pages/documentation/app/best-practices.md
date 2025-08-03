# Best Practices

This guide covers best practices for building robust, maintainable, and performant Deepkit applications.

## Project Structure

Organize your project for clarity and maintainability:

```
my-app/
├── src/
│   ├── commands/           # CLI command controllers
│   │   ├── user.cli.ts
│   │   └── database.cli.ts
│   ├── services/           # Business logic services
│   │   ├── user.service.ts
│   │   └── email.service.ts
│   ├── modules/            # Feature modules
│   │   ├── user.module.ts
│   │   └── auth.module.ts
│   ├── config/             # Configuration classes
│   │   └── app.config.ts
│   └── types/              # Type definitions
│       └── user.types.ts
├── tests/                  # Test files
│   ├── commands/
│   ├── services/
│   └── integration/
├── app.ts                  # Application entry point
├── tsconfig.json
└── package.json
```

## Configuration Management

### Use Type-Safe Configuration

Always define configuration with proper types and validation:

```typescript
import { MinLength, Minimum, Email } from '@deepkit/type';

export class AppConfig {
    // Required fields
    databaseUrl!: string & MinLength<10>;
    
    // Optional with defaults
    port: number & Minimum<1000> = 3000;
    debug: boolean = false;
    
    // Validated types
    adminEmail?: string & Email;
    
    // Nested configuration
    redis: {
        host: string;
        port: number;
    } = {
        host: 'localhost',
        port: 6379
    };
}
```

### Environment-Specific Configuration

Use environment variables for deployment-specific values:

```typescript
const app = new App({
    config: AppConfig
})
.loadConfigFromEnv({
    prefix: 'MYAPP_',
    envFilePath: ['.env.local', '.env']
})
.configure({
    // Override defaults programmatically
    debug: process.env.NODE_ENV === 'development'
});
```

## Service Design

### Single Responsibility Principle

Keep services focused on a single responsibility:

```typescript
// Good: Focused service
export class UserRepository {
    async findById(id: string): Promise<User | null> {
        // Database access logic only
    }
    
    async save(user: User): Promise<void> {
        // Save logic only
    }
}

export class UserService {
    constructor(
        private userRepo: UserRepository,
        private emailService: EmailService
    ) {}
    
    async createUser(userData: CreateUserData): Promise<User> {
        // Business logic only
        const user = new User(userData);
        await this.userRepo.save(user);
        await this.emailService.sendWelcomeEmail(user.email);
        return user;
    }
}
```

### Dependency Injection Best Practices

Use constructor injection and interface segregation:

```typescript
// Good: Interface segregation
interface EmailSender {
    sendEmail(to: string, subject: string, body: string): Promise<void>;
}

interface UserNotifier {
    notifyUserCreated(user: User): Promise<void>;
}

export class UserService {
    constructor(
        private userRepo: UserRepository,
        private emailSender: EmailSender,
        private notifier: UserNotifier
    ) {}
}

// Implementation
export class EmailService implements EmailSender, UserNotifier {
    async sendEmail(to: string, subject: string, body: string): Promise<void> {
        // Implementation
    }
    
    async notifyUserCreated(user: User): Promise<void> {
        await this.sendEmail(user.email, 'Welcome!', 'Welcome to our app');
    }
}
```

## Command Design

### Use Descriptive Command Names

Choose clear, action-oriented command names:

```typescript
// Good: Clear command structure
app.command('user:create', createUserCommand);
app.command('user:delete', deleteUserCommand);
app.command('user:list', listUsersCommand);
app.command('database:migrate', migrateCommand);
app.command('database:seed', seedCommand);
```

### Validate Input Early

Use TypeScript types and validation for robust commands:

```typescript
import { Email, MinLength, Positive } from '@deepkit/type';

@cli.controller('user:create')
export class CreateUserCommand {
    async execute(
        /** @description User's email address */
        email: string & Email,
        
        /** @description User's full name */
        name: string & MinLength<2>,
        
        /** @description User's age */
        age: number & Positive,
        
        /** @description Send welcome email */
        sendWelcome: boolean & Flag = true
    ) {
        // Input is guaranteed to be valid here
        const user = await this.userService.createUser({
            email, name, age
        });
        
        if (sendWelcome) {
            await this.emailService.sendWelcomeEmail(email);
        }
        
        console.log(`User created: ${user.id}`);
    }
}
```

### Handle Errors Gracefully

Provide meaningful error messages and appropriate exit codes:

```typescript
@cli.controller('user:delete')
export class DeleteUserCommand {
    async execute(id: string): Promise<number> {
        try {
            const user = await this.userService.findById(id);
            if (!user) {
                console.error(`User with ID ${id} not found`);
                return 1; // Exit code for "not found"
            }
            
            await this.userService.delete(id);
            console.log(`User ${id} deleted successfully`);
            return 0; // Success
            
        } catch (error) {
            console.error(`Failed to delete user: ${error.message}`);
            return 2; // Exit code for "operation failed"
        }
    }
}
```

## Module Organization

### Feature-Based Modules

Organize modules around business features:

```typescript
// user.module.ts
export class UserModule extends createModuleClass({
    providers: [
        UserService,
        UserRepository,
        UserValidator
    ],
    controllers: [
        CreateUserCommand,
        DeleteUserCommand,
        ListUsersCommand
    ],
    exports: [
        UserService // Export what other modules might need
    ]
}) {}

// auth.module.ts  
export class AuthModule extends createModuleClass({
    imports: [new UserModule()], // Import user functionality
    providers: [
        AuthService,
        TokenService
    ],
    controllers: [
        LoginCommand,
        LogoutCommand
    ]
}) {}
```

### Configuration Inheritance

Use module configuration for reusable components:

```typescript
export class DatabaseConfig {
    host: string = 'localhost';
    port: number = 5432;
    database!: string;
    username!: string;
    password!: string;
}

export class DatabaseModule extends createModuleClass({
    config: DatabaseConfig,
    providers: [DatabaseService],
    exports: [DatabaseService]
}) {
    process() {
        // Validate configuration
        if (!this.config.database) {
            throw new Error('Database name is required');
        }
    }
}

// Usage
const app = new App({
    imports: [
        new DatabaseModule({
            database: 'myapp',
            username: 'user',
            password: 'pass'
        })
    ]
});
```

## Error Handling

### Global Error Handling

Set up global error handlers for consistent error management:

```typescript
import { onAppError } from '@deepkit/app';

const app = new App({
    providers: [ErrorReportingService]
});

app.listen(onAppError, async (event, errorReporting: ErrorReportingService, logger: Logger) => {
    // Log the error
    logger.error('Command failed:', {
        command: event.command,
        error: event.error.message,
        stack: event.error.stack
    });
    
    // Report to external service
    await errorReporting.reportError(event.error, {
        command: event.command,
        parameters: event.parameters
    });
    
    // Return appropriate exit code
    if (event.error instanceof ValidationError) {
        return 1; // User input error
    } else if (event.error instanceof NetworkError) {
        return 2; // Network/external service error
    } else {
        return 3; // Internal application error
    }
});
```

### Custom Error Types

Create specific error types for better error handling:

```typescript
export class UserNotFoundError extends Error {
    constructor(userId: string) {
        super(`User with ID ${userId} not found`);
        this.name = 'UserNotFoundError';
    }
}

export class ValidationError extends Error {
    constructor(field: string, value: any) {
        super(`Invalid value for ${field}: ${value}`);
        this.name = 'ValidationError';
    }
}

// Usage in services
export class UserService {
    async findById(id: string): Promise<User> {
        const user = await this.userRepo.findById(id);
        if (!user) {
            throw new UserNotFoundError(id);
        }
        return user;
    }
}
```

## Performance Optimization

### Lazy Loading

Use lazy loading for expensive services:

```typescript
export class ExpensiveService {
    private initialized = false;
    
    async initialize() {
        if (this.initialized) return;
        
        // Expensive initialization
        await this.loadLargeDataset();
        this.initialized = true;
    }
    
    async doWork() {
        await this.initialize();
        // Work with initialized data
    }
}
```

### Scoped Services

Use appropriate service scopes:

```typescript
const app = new App({
    providers: [
        // Singleton: Shared across the entire application
        DatabaseService,
        
        // Transient: New instance every time
        { provide: RequestProcessor, scope: Scope.transient },
        
        // CLI scoped: One instance per command execution
        { provide: CommandContext, scope: 'cli' }
    ]
});
```

## Testing Strategy

### Test Pyramid

Follow the test pyramid principle:

```typescript
// Unit tests (most)
test('UserService.createUser validates email', () => {
    const service = new UserService(mockRepo, mockEmail);
    expect(() => service.createUser({ email: 'invalid' }))
        .toThrow('Invalid email');
});

// Integration tests (some)
test('CreateUserCommand integration', async () => {
    const testing = createTestingApp({
        controllers: [CreateUserCommand],
        providers: [UserService, UserRepository]
    });
    
    const exitCode = await testing.app.execute([
        'user:create', 'test@example.com', 'John Doe', '25'
    ]);
    
    expect(exitCode).toBe(0);
});

// E2E tests (few)
test('Full user creation workflow', async () => {
    // Test the entire application flow
});
```

### Mock External Dependencies

Mock external services in tests:

```typescript
const mockEmailService = {
    sendEmail: jest.fn().mockResolvedValue(true)
};

const testing = createTestingApp({
    providers: [
        UserService,
        { provide: EmailService, useValue: mockEmailService }
    ]
});
```

## Security Considerations

### Input Validation

Always validate and sanitize input:

```typescript
import { Email, MinLength, Pattern } from '@deepkit/type';

// Use type constraints for validation
type SafeString = string & MinLength<1> & Pattern<'^[a-zA-Z0-9\\s]+$'>;

@cli.controller('user:update')
export class UpdateUserCommand {
    async execute(
        id: string,
        name: SafeString,
        email: string & Email
    ) {
        // Input is automatically validated
    }
}
```

### Environment Variables

Never commit secrets to version control:

```typescript
export class AppConfig {
    // Use environment variables for secrets
    databasePassword!: string; // Set via MYAPP_DATABASE_PASSWORD
    apiKey!: string;           // Set via MYAPP_API_KEY
    
    // Public configuration can have defaults
    port: number = 3000;
    debug: boolean = false;
}
```

## Monitoring and Logging

### Structured Logging

Use structured logging for better observability:

```typescript
export class UserService {
    constructor(private logger: Logger) {}
    
    async createUser(userData: CreateUserData): Promise<User> {
        this.logger.log('Creating user', {
            email: userData.email,
            timestamp: new Date().toISOString()
        });
        
        try {
            const user = await this.userRepo.save(new User(userData));
            
            this.logger.log('User created successfully', {
                userId: user.id,
                email: user.email
            });
            
            return user;
        } catch (error) {
            this.logger.error('Failed to create user', {
                email: userData.email,
                error: error.message
            });
            throw error;
        }
    }
}
```

### Health Checks

Implement health checks for monitoring:

```typescript
@cli.controller('health:check')
export class HealthCheckCommand {
    constructor(
        private db: DatabaseService,
        private redis: RedisService
    ) {}
    
    async execute(): Promise<number> {
        try {
            await this.db.ping();
            await this.redis.ping();
            
            console.log('All services healthy');
            return 0;
        } catch (error) {
            console.error('Health check failed:', error.message);
            return 1;
        }
    }
}
```
