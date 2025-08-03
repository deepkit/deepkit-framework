# Testing

Testing is a crucial part of building reliable applications. Deepkit App provides excellent testing capabilities through its dependency injection system and testing utilities. This chapter covers how to test your CLI commands, services, and modules effectively.

## Testing Setup

First, make sure you have Jest (or your preferred testing framework) installed:

```bash
npm install --save-dev jest @types/jest ts-jest
```

Configure Jest in your `package.json`:

```json
{
  "scripts": {
    "test": "jest"
  },
  "jest": {
    "preset": "ts-jest",
    "testEnvironment": "node",
    "testMatch": ["**/*.spec.ts"]
  }
}
```

## Testing Services

The simplest way to test services is to instantiate them directly:

```typescript
import { Logger, MemoryLoggerTransport } from '@deepkit/logger';

class UserService {
    constructor(private logger: Logger) {}
    
    createUser(name: string): boolean {
        this.logger.log('Creating user:', name);
        return true;
    }
}

test('UserService creates user', () => {
    const memoryLogger = new MemoryLoggerTransport();
    const logger = new Logger([memoryLogger]);
    const service = new UserService(logger);
    
    const result = service.createUser('John');
    
    expect(result).toBe(true);
    expect(memoryLogger.messages[0]).toMatchObject({
        message: 'Creating user: John'
    });
});
```

## Testing with Dependency Injection

For more complex scenarios, use the `createTestingApp` function from `@deepkit/framework`:

```typescript
import { createTestingApp } from '@deepkit/framework';

class DatabaseService {
    users: string[] = [];
    
    addUser(name: string) {
        this.users.push(name);
    }
    
    getUsers() {
        return this.users;
    }
}

class UserService {
    constructor(private db: DatabaseService) {}
    
    createUser(name: string) {
        this.db.addUser(name);
        return `User ${name} created`;
    }
}

test('UserService with DI', () => {
    const testing = createTestingApp({
        providers: [DatabaseService, UserService]
    });
    
    const userService = testing.app.get(UserService);
    const result = userService.createUser('Alice');
    
    expect(result).toBe('User Alice created');
    
    const dbService = testing.app.get(DatabaseService);
    expect(dbService.getUsers()).toEqual(['Alice']);
});
```

## Testing CLI Commands

### Functional Commands

Test functional commands by calling them directly through the app:

```typescript
import { createTestingApp } from '@deepkit/framework';

test('hello command', async () => {
    const testing = createTestingApp({});
    
    testing.app.command('hello', (name: string) => {
        return `Hello ${name}!`;
    });
    
    const result = await testing.app.execute(['hello', 'World']);
    expect(result).toBe(0); // exit code
});
```

### Class-based Commands

For class-based commands, test them through the DI container:

```typescript
import { cli } from '@deepkit/app';

@cli.controller('greet')
class GreetCommand {
    constructor(private userService: UserService) {}
    
    async execute(name: string): Promise<string> {
        return this.userService.createUser(name);
    }
}

test('GreetCommand', async () => {
    const testing = createTestingApp({
        controllers: [GreetCommand],
        providers: [DatabaseService, UserService]
    });
    
    await testing.app.execute(['greet', 'Bob']);
    
    const dbService = testing.app.get(DatabaseService);
    expect(dbService.getUsers()).toContain('Bob');
});
```

## Mocking Dependencies

Use Jest mocks or custom providers to mock dependencies:

```typescript
class EmailService {
    sendEmail(to: string, subject: string): boolean {
        // In real implementation, this would send an email
        return true;
    }
}

class NotificationService {
    constructor(private emailService: EmailService) {}
    
    notifyUser(email: string, message: string): boolean {
        return this.emailService.sendEmail(email, message);
    }
}

test('NotificationService with mock', () => {
    const mockEmailService = {
        sendEmail: jest.fn().mockReturnValue(true)
    };
    
    const testing = createTestingApp({
        providers: [
            NotificationService,
            { provide: EmailService, useValue: mockEmailService }
        ]
    });
    
    const notificationService = testing.app.get(NotificationService);
    const result = notificationService.notifyUser('test@example.com', 'Hello');
    
    expect(result).toBe(true);
    expect(mockEmailService.sendEmail).toHaveBeenCalledWith('test@example.com', 'Hello');
});
```

## Testing Modules

Test modules by importing them into a test app:

```typescript
import { createModuleClass } from '@deepkit/app';

class ModuleConfig {
    apiKey: string = 'default-key';
}

class ApiService {
    constructor(private apiKey: ModuleConfig['apiKey']) {}
    
    getApiKey() {
        return this.apiKey;
    }
}

class ApiModule extends createModuleClass({
    config: ModuleConfig,
    providers: [ApiService],
    exports: [ApiService]
}) {}

test('ApiModule configuration', () => {
    const testing = createTestingApp({
        imports: [new ApiModule({ apiKey: 'test-key' })]
    });
    
    const apiService = testing.app.get(ApiService);
    expect(apiService.getApiKey()).toBe('test-key');
});
```

## Testing Configuration

Test configuration loading and validation:

```typescript
import { MinLength } from '@deepkit/type';

class AppConfig {
    name: string & MinLength<3> = 'MyApp';
    port: number = 3000;
}

test('configuration validation', () => {
    expect(() => {
        createTestingApp({
            config: AppConfig
        }, { name: 'AB' }); // Too short, should fail validation
    }).toThrow();
});

test('valid configuration', () => {
    const testing = createTestingApp({
        config: AppConfig
    });
    
    testing.app.configure({ name: 'TestApp', port: 8080 });
    
    const config = testing.app.get(AppConfig);
    expect(config.name).toBe('TestApp');
    expect(config.port).toBe(8080);
});
```

## Testing Event Listeners

Test event listeners by dispatching events:

```typescript
import { EventToken } from '@deepkit/event';

const UserCreated = new EventToken('user.created');

class UserEventListener {
    lastCreatedUser?: string;
    
    @eventDispatcher.listen(UserCreated)
    onUserCreated(event: typeof UserCreated.event) {
        this.lastCreatedUser = event.data;
    }
}

test('event listener', async () => {
    const testing = createTestingApp({
        listeners: [UserEventListener]
    });
    
    await testing.app.dispatch(UserCreated, 'John');
    
    const listener = testing.app.get(UserEventListener);
    expect(listener.lastCreatedUser).toBe('John');
});
```

## Integration Testing

For integration tests, you can test the entire command execution:

```typescript
test('full command integration', async () => {
    const testing = createTestingApp({
        providers: [DatabaseService, UserService],
        controllers: [GreetCommand]
    });
    
    // Test command execution with arguments
    const exitCode = await testing.app.execute(['greet', 'Integration Test']);
    expect(exitCode).toBe(0);
    
    // Verify side effects
    const dbService = testing.app.get(DatabaseService);
    expect(dbService.getUsers()).toContain('Integration Test');
});
```

## Best Practices

1. **Isolate tests**: Each test should be independent and not rely on state from other tests.

2. **Use dependency injection**: Leverage DI to inject mocks and test doubles.

3. **Test behavior, not implementation**: Focus on what your code does, not how it does it.

4. **Use descriptive test names**: Make it clear what each test is verifying.

5. **Test edge cases**: Include tests for error conditions and boundary values.

6. **Keep tests simple**: Each test should verify one specific behavior.

```typescript
// Good: Descriptive name and single responsibility
test('UserService throws error when creating user with empty name', () => {
    const service = new UserService(mockLogger);
    expect(() => service.createUser('')).toThrow('Name cannot be empty');
});

// Good: Testing the happy path
test('UserService successfully creates user with valid name', () => {
    const service = new UserService(mockLogger);
    const result = service.createUser('John');
    expect(result).toBe(true);
});
```
