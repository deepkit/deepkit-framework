# Testing with Dependency Injection

Dependency injection makes testing easier by allowing you to replace real dependencies with mocks, stubs, or test doubles. This guide shows how to effectively test applications using Deepkit's DI system.

## Unit Testing Basics

### Testing Services with Dependencies

```typescript
// Service under test
class UserService {
    constructor(
        private repository: UserRepository,
        private emailService: EmailService,
        private logger: Logger
    ) {}
    
    async createUser(userData: CreateUserData): Promise<User> {
        this.logger.log(`Creating user: ${userData.email}`);
        
        const user = await this.repository.create(userData);
        await this.emailService.sendWelcomeEmail(user);
        
        this.logger.log(`User created: ${user.id}`);
        return user;
    }
}

// Test with mocks
describe('UserService', () => {
    let userService: UserService;
    let mockRepository: jest.Mocked<UserRepository>;
    let mockEmailService: jest.Mocked<EmailService>;
    let mockLogger: jest.Mocked<Logger>;
    
    beforeEach(() => {
        // Create mocks
        mockRepository = {
            create: jest.fn(),
            findById: jest.fn(),
            update: jest.fn(),
            delete: jest.fn()
        } as any;
        
        mockEmailService = {
            sendWelcomeEmail: jest.fn(),
            sendPasswordReset: jest.fn()
        } as any;
        
        mockLogger = {
            log: jest.fn(),
            error: jest.fn(),
            warn: jest.fn()
        } as any;
        
        // Create test injector with mocks
        const testInjector = Injector.from([
            { provide: UserRepository, useValue: mockRepository },
            { provide: EmailService, useValue: mockEmailService },
            { provide: Logger, useValue: mockLogger },
            UserService
        ]);
        
        userService = testInjector.get(UserService);
    });
    
    it('should create user and send welcome email', async () => {
        // Arrange
        const userData = { email: 'test@example.com', name: 'Test User' };
        const createdUser = { id: '123', ...userData };
        
        mockRepository.create.mockResolvedValue(createdUser);
        mockEmailService.sendWelcomeEmail.mockResolvedValue(undefined);
        
        // Act
        const result = await userService.createUser(userData);
        
        // Assert
        expect(result).toEqual(createdUser);
        expect(mockRepository.create).toHaveBeenCalledWith(userData);
        expect(mockEmailService.sendWelcomeEmail).toHaveBeenCalledWith(createdUser);
        expect(mockLogger.log).toHaveBeenCalledWith('Creating user: test@example.com');
        expect(mockLogger.log).toHaveBeenCalledWith('User created: 123');
    });
});
```

### Testing with Test Modules

For more complex scenarios, create dedicated test modules:

```typescript
// Test module factory
function createTestModule(overrides: Partial<{
    userRepository: UserRepository;
    emailService: EmailService;
    logger: Logger;
}> = {}) {
    return new InjectorModule([
        {
            provide: UserRepository,
            useValue: overrides.userRepository || createMockUserRepository()
        },
        {
            provide: EmailService,
            useValue: overrides.emailService || createMockEmailService()
        },
        {
            provide: Logger,
            useValue: overrides.logger || createMockLogger()
        },
        UserService
    ]);
}

// Test with custom module
describe('UserService Integration', () => {
    it('should handle repository errors gracefully', async () => {
        const mockRepository = createMockUserRepository();
        mockRepository.create.mockRejectedValue(new Error('Database error'));
        
        const testModule = createTestModule({ userRepository: mockRepository });
        const injector = new InjectorContext(testModule);
        const userService = injector.get(UserService);
        
        await expect(userService.createUser({ email: 'test@example.com' }))
            .rejects.toThrow('Database error');
    });
});
```

## Integration Testing

### Testing Module Integration

Test how modules work together:

```typescript
describe('User Module Integration', () => {
    let injector: InjectorContext;
    
    beforeEach(() => {
        const databaseModule = new InjectorModule([
            { provide: Database, useValue: createTestDatabase() }
        ]).addExport(Database);
        
        const userModule = new InjectorModule([
            UserRepository,
            UserService
        ]).addImport(databaseModule);
        
        const rootModule = new InjectorModule([])
            .addImport(userModule);
        
        injector = new InjectorContext(rootModule);
    });
    
    it('should resolve all dependencies correctly', () => {
        const userService = injector.get(UserService, userModule);
        expect(userService).toBeInstanceOf(UserService);
        
        // Verify dependencies are injected
        expect(userService['repository']).toBeInstanceOf(UserRepository);
    });
});
```

### Testing Scoped Services

Test services that use scopes:

```typescript
describe('Scoped Services', () => {
    let injector: InjectorContext;
    
    beforeEach(() => {
        injector = InjectorContext.forProviders([
            { provide: UserSession, scope: 'http' },
            { provide: RequestLogger, scope: 'http' },
            Database // Global service
        ]);
    });
    
    it('should create separate instances per scope', () => {
        const scope1 = injector.createChildScope('http');
        const scope2 = injector.createChildScope('http');
        
        const session1 = scope1.get(UserSession);
        const session2 = scope2.get(UserSession);
        
        expect(session1).not.toBe(session2);
    });
    
    it('should share global services across scopes', () => {
        const scope1 = injector.createChildScope('http');
        const scope2 = injector.createChildScope('http');
        
        const db1 = scope1.get(Database);
        const db2 = scope2.get(Database);
        
        expect(db1).toBe(db2); // Same instance
    });
});
```

## Testing Patterns

### Mock Factories

Create reusable mock factories:

```typescript
// Mock factory functions
function createMockUserRepository(): jest.Mocked<UserRepository> {
    return {
        create: jest.fn(),
        findById: jest.fn(),
        findByEmail: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        findAll: jest.fn()
    } as any;
}

function createMockEmailService(): jest.Mocked<EmailService> {
    return {
        sendWelcomeEmail: jest.fn().mockResolvedValue(undefined),
        sendPasswordReset: jest.fn().mockResolvedValue(undefined),
        sendNotification: jest.fn().mockResolvedValue(undefined)
    } as any;
}

// Test helper
class TestInjectorBuilder {
    private providers: any[] = [];
    
    withMockUserRepository(mock?: Partial<UserRepository>) {
        const mockRepo = { ...createMockUserRepository(), ...mock };
        this.providers.push({ provide: UserRepository, useValue: mockRepo });
        return this;
    }
    
    withMockEmailService(mock?: Partial<EmailService>) {
        const mockEmail = { ...createMockEmailService(), ...mock };
        this.providers.push({ provide: EmailService, useValue: mockEmail });
        return this;
    }
    
    withService<T>(serviceClass: ClassType<T>) {
        this.providers.push(serviceClass);
        return this;
    }
    
    build(): Injector {
        return Injector.from(this.providers);
    }
}

// Usage in tests
describe('UserService', () => {
    it('should create user successfully', async () => {
        const injector = new TestInjectorBuilder()
            .withMockUserRepository({
                create: jest.fn().mockResolvedValue({ id: '123', email: 'test@example.com' })
            })
            .withMockEmailService()
            .withService(UserService)
            .build();
        
        const userService = injector.get(UserService);
        const result = await userService.createUser({ email: 'test@example.com' });
        
        expect(result.id).toBe('123');
    });
});
```

### Testing Configuration

Test services that depend on configuration:

```typescript
class TestConfig {
    apiUrl: string = 'http://test-api.example.com';
    debug: boolean = true;
    timeout: number = 5000;
}

describe('ConfigurableService', () => {
    it('should use test configuration', () => {
        const testModule = new InjectorModule([ConfigurableService])
            .setConfigDefinition(TestConfig)
            .configure({
                apiUrl: 'http://mock-api.example.com',
                timeout: 1000
            });
        
        const injector = new InjectorContext(testModule);
        const service = injector.get(ConfigurableService);
        
        // Verify service uses test configuration
        expect(service.getApiUrl()).toBe('http://mock-api.example.com');
    });
});
```

### Testing Tagged Providers

Test services that use tagged providers:

```typescript
describe('Plugin System', () => {
    it('should load all registered plugins', () => {
        class TestPlugin1 implements Plugin {
            name = 'test1';
            process(data: any) { return { ...data, test1: true }; }
        }
        
        class TestPlugin2 implements Plugin {
            name = 'test2';
            process(data: any) { return { ...data, test2: true }; }
        }
        
        const injector = Injector.from([
            PluginManager,
            PluginTag.provide(TestPlugin1),
            PluginTag.provide(TestPlugin2)
        ]);
        
        const manager = injector.get(PluginManager);
        const result = manager.processData({ input: 'test' });
        
        expect(result).toEqual({
            input: 'test',
            test1: true,
            test2: true
        });
    });
});
```

## Testing Best Practices

### 1. Isolate Units Under Test

```typescript
// Good: Test only UserService behavior
const injector = Injector.from([
    { provide: UserRepository, useValue: mockRepository },
    { provide: EmailService, useValue: mockEmailService },
    UserService
]);

// Avoid: Testing multiple real services together in unit tests
const injector = Injector.from([
    UserRepository,  // Real implementation
    EmailService,    // Real implementation
    UserService
]);
```

### 2. Use Descriptive Test Names

```typescript
describe('UserService', () => {
    describe('createUser', () => {
        it('should create user and send welcome email when valid data provided', () => {
            // Test implementation
        });
        
        it('should throw validation error when email is invalid', () => {
            // Test implementation
        });
        
        it('should not send email when email service fails but still create user', () => {
            // Test implementation
        });
    });
});
```

### 3. Test Error Scenarios

```typescript
it('should handle repository errors gracefully', async () => {
    mockRepository.create.mockRejectedValue(new Error('Database connection failed'));
    
    await expect(userService.createUser(validUserData))
        .rejects.toThrow('Database connection failed');
    
    // Verify email service was not called
    expect(mockEmailService.sendWelcomeEmail).not.toHaveBeenCalled();
});
```

### 4. Verify Interactions

```typescript
it('should log user creation process', async () => {
    await userService.createUser(userData);
    
    expect(mockLogger.log).toHaveBeenCalledWith('Creating user: test@example.com');
    expect(mockLogger.log).toHaveBeenCalledWith('User created: 123');
    expect(mockLogger.log).toHaveBeenCalledTimes(2);
});
```

### 5. Clean Up After Tests

```typescript
afterEach(() => {
    jest.clearAllMocks();
    // Clean up any global state
});
```

## Testing Tools Integration

### Jest Integration

```typescript
// jest.config.js
module.exports = {
    preset: 'ts-jest',
    testEnvironment: 'node',
    setupFilesAfterEnv: ['<rootDir>/src/test-setup.ts']
};

// test-setup.ts
import 'reflect-metadata';

// Global test utilities
global.createTestInjector = (providers: any[]) => {
    return Injector.from(providers);
};
```

### Vitest Integration

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        globals: true,
        environment: 'node',
        setupFiles: ['./src/test-setup.ts']
    }
});
```

By following these testing patterns and practices, you can build comprehensive test suites that verify your dependency injection setup works correctly and your services behave as expected.
