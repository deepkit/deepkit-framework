# Testing

The services and controllers in the Deepkit framework are designed to support SOLID and clean code that is well-designed, encapsulated, and separated. These features make the code easy to test.

This documentation shows you how to set up a testing framework named [Jest](https://jestjs.io) with `ts-jest` and covers comprehensive testing patterns for Deepkit Framework applications.

## Setup

Install Jest and TypeScript support:

```sh
npm install jest ts-jest @types/jest --save-dev
```

Configure Jest in your `package.json`:

```json title=package.json
{
  "scripts": {
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage"
  },
  "jest": {
    "transform": {
      "^.+\\.(ts|tsx)$": "ts-jest"
    },
    "testEnvironment": "node",
    "testMatch": [
      "**/*.spec.ts"
    ],
    "collectCoverageFrom": [
      "src/**/*.ts",
      "!src/**/*.d.ts"
    ]
  }
}
```

Your test files should be named `.spec.ts`. Create a `test.spec.ts` file with the following content.

```typescript
test('first test', () => {
    expect(1 + 1).toBe(2);
});
```

You can now use the jest command to run all your test suits at once.

```sh
$ node_modules/.bin/jest
 PASS  ./test.spec.ts
  ✓ first test (1 ms)

Test Suites: 1 passed, 1 total
Tests:       1 passed, 1 total
Snapshots:   0 total
Time:        0.23 s, estimated 1 s
Ran all test suites.
```

Please read the [Jest-Dokumentation](https://jestjs.io) to learn more about how the Jest CLI tool works and how you can write more sophisticated tests and entire test suites.

## Unit Tests

Unit tests are the simplest form of testing. They test a single unit of code, such as a function or a class, in isolation. Since Deepkit's dependency injection container is very powerful, it's easy to test individual services and controllers.

### Testing Services

Test services by instantiating them directly:

```typescript
export class MyService {
    helloWorld() {
        return 'hello world';
    }

    async calculateAsync(value: number): Promise<number> {
        return value * 2;
    }
}
```

```typescript
import { expect, test } from '@jest/globals';
import { MyService } from './my-service.ts';

test('hello world', () => {
    const myService = new MyService();
    expect(myService.helloWorld()).toBe('hello world');
});

test('async calculation', async () => {
    const myService = new MyService();
    const result = await myService.calculateAsync(5);
    expect(result).toBe(10);
});
```

### Testing Services with Dependencies

Use mocks for service dependencies:

```typescript
class DatabaseService {
    async findUser(id: number) {
        // Database logic
    }
}

class UserService {
    constructor(private db: DatabaseService) {}

    async getUser(id: number) {
        const user = await this.db.findUser(id);
        return user ? { ...user, active: true } : null;
    }
}

test('user service with mock', async () => {
    const mockDb = {
        findUser: jest.fn().mockResolvedValue({ id: 1, name: 'John' })
    } as any;

    const userService = new UserService(mockDb);
    const user = await userService.getUser(1);

    expect(user).toEqual({ id: 1, name: 'John', active: true });
    expect(mockDb.findUser).toHaveBeenCalledWith(1);
});
```

## Integration Tests

Integration tests verify that multiple components work together correctly. Deepkit Framework provides powerful testing utilities that make it easy to test your entire application or specific modules.

The `createTestingApp` function creates a test application with in-memory services, making tests fast and isolated. It automatically configures:

- In-memory HTTP server (no TCP stack)
- In-memory RPC communication
- Memory-based logger
- Memory-based broker
- Memory-based database (if entities provided)

### Basic Integration Testing

Use `createTestingApp` to create a test application:

```typescript
import { createTestingApp } from '@deepkit/framework';
import { http, HttpRequest } from '@deepkit/http';

test('http controller', async () => {
    class MyController {

        @http.GET()
        hello(@http.query() text: string) {
            return 'hello ' + text;
        }
    }

    const testing = createTestingApp({ controllers: [MyController] });
    await testing.startServer();

    const response = await testing.request(HttpRequest.GET('/').query({text: 'world'}));

    expect(response.getHeader('content-type')).toBe('text/plain; charset=utf-8');
    expect(response.body.toString()).toBe('hello world');
});
```

```typescript
import { createTestingApp } from '@deepkit/framework';

test('service', async () => {
    class MyService {
        helloWorld() {
            return 'hello world';
        }
    }

    const testing = createTestingApp({ providers: [MyService] });

    //access the dependency injection container and instantiate MyService
    const myService = testing.app.get(MyService);

    expect(myService.helloWorld()).toBe('hello world');
});
```

If you have divided your application into several modules, you can test them more easily. For example, suppose you have created an `AppCoreModule` and want to test some services.

```typescript
class Config {
    items: number = 10;
}

export class MyService {
    constructor(protected items: Config['items']) {

    }

    doIt(): boolean {
        //do something
        return true;
    }
}

export AppCoreModule = new AppModule({}, {
    config: config,
    provides: [MyService]
}, 'core');
```

You use your module as follows:

```typescript
import { AppCoreModule } from './app-core.ts';

new App({
    imports: [new AppCoreModule]
}).run();
```

And test it without booting the entire application server.

```typescript
import { createTestingApp } from '@deepkit/framework';
import { AppCoreModule, MyService } from './app-core.ts';

test('service simple', async () => {
    const testing = createTestingApp({ imports: [new AppCoreModule] });

    const myService = testing.app.get(MyService);
    expect(myService.doIt()).toBe(true);
});

test('service simple big', async () => {
    // you change configurations of your module for specific test scenarios
    const testing = createTestingApp({
        imports: [new AppCoreModule({items: 100})]
    });

    const myService = testing.app.get(MyService);
    expect(myService.doIt()).toBe(true);
});
```

## HTTP Controller Testing

Test HTTP controllers using the testing utilities:

```typescript
import { createTestingApp } from '@deepkit/framework';
import { http, HttpRequest } from '@deepkit/http';

test('http controller', async () => {
    class MyController {
        @http.GET('/users/:id')
        getUser(@http.param() id: number) {
            return { id, name: `User ${id}` };
        }

        @http.POST('/users')
        createUser(@http.body() userData: any) {
            return { id: 123, ...userData };
        }
    }

    const testing = createTestingApp({ controllers: [MyController] });
    await testing.startServer();

    try {
        // Test GET request
        const getResponse = await testing.request(HttpRequest.GET('/users/42'));
        expect(getResponse.statusCode).toBe(200);
        expect(getResponse.json).toEqual({ id: 42, name: 'User 42' });

        // Test POST request
        const postResponse = await testing.request(
            HttpRequest.POST('/users').json({ name: 'John', email: 'john@example.com' })
        );
        expect(postResponse.statusCode).toBe(200);
        expect(postResponse.json).toEqual({
            id: 123,
            name: 'John',
            email: 'john@example.com'
        });
    } finally {
        await testing.stopServer();
    }
});
```

## RPC Controller Testing

Test RPC controllers with full type safety:

```typescript
import { createTestingApp } from '@deepkit/framework';
import { rpc } from '@deepkit/rpc';

test('rpc controller', async () => {
    @rpc.controller('main')
    class MainController {
        @rpc.action()
        hello(name: string): string {
            return `Hello ${name}!`;
        }

        @rpc.action()
        async getUser(id: number): Promise<{ id: number; name: string }> {
            return { id, name: `User ${id}` };
        }
    }

    const testing = createTestingApp({ controllers: [MainController] });
    await testing.startServer();

    try {
        const client = testing.createRpcClient();
        const controller = client.controller<MainController>('main');

        const greeting = await controller.hello('World');
        expect(greeting).toBe('Hello World!');

        const user = await controller.getUser(123);
        expect(user).toEqual({ id: 123, name: 'User 123' });
    } finally {
        await testing.stopServer();
    }
});
```

## Database Testing

Test with in-memory database for fast, isolated tests:

```typescript
import { createTestingApp } from '@deepkit/framework';
import { entity, PrimaryKey } from '@deepkit/type';
import { Database } from '@deepkit/orm';

@entity.name('user')
class User {
    id: PrimaryKey = 0;
    name: string = '';
    email: string = '';
}

test('database operations', async () => {
    const testing = createTestingApp({}, [User]);

    const database = testing.app.get(Database);

    // Create user
    const user = new User();
    user.name = 'John';
    user.email = 'john@example.com';

    await database.persist(user);
    expect(user.id).toBeGreaterThan(0);

    // Query user
    const foundUser = await database.query(User).filter({ name: 'John' }).findOne();
    expect(foundUser).toBeDefined();
    expect(foundUser!.email).toBe('john@example.com');

    // Count users
    const count = await database.query(User).count();
    expect(count).toBe(1);
});
```

## Testing with Dependencies

Test controllers and services with complex dependencies:

```typescript
import { createTestingApp } from '@deepkit/framework';
import { Logger } from '@deepkit/logger';

class UserService {
    constructor(private logger: Logger) {}

    async createUser(name: string) {
        this.logger.log(`Creating user: ${name}`);
        return { id: 1, name };
    }
}

@rpc.controller('users')
class UserController {
    constructor(private userService: UserService) {}

    @rpc.action()
    async create(name: string) {
        return await this.userService.createUser(name);
    }
}

test('controller with dependencies', async () => {
    const testing = createTestingApp({
        providers: [UserService],
        controllers: [UserController]
    });

    await testing.startServer();

    try {
        const client = testing.createRpcClient();
        const controller = client.controller<UserController>('users');

        const user = await controller.create('John');
        expect(user).toEqual({ id: 1, name: 'John' });

        // Check logs
        const logger = testing.getLogger();
        expect(logger.messageStrings).toContain('Creating user: John');
    } finally {
        await testing.stopServer();
    }
});
```

## Testing Authentication

Test RPC authentication and security:

```typescript
import { createTestingApp } from '@deepkit/framework';
import { RpcKernelSecurity, Session } from '@deepkit/rpc';

class TestRpcSecurity extends RpcKernelSecurity {
    async authenticate(token: any): Promise<Session> {
        if (token === 'valid-token') {
            return new Session('user123', token);
        }
        throw new Error('Invalid token');
    }
}

@rpc.controller('secure')
class SecureController {
    @rpc.action()
    getSecretData() {
        return { secret: 'classified' };
    }
}

test('rpc authentication', async () => {
    const testing = createTestingApp({
        providers: [
            { provide: RpcKernelSecurity, useClass: TestRpcSecurity }
        ],
        controllers: [SecureController]
    });

    await testing.startServer();

    try {
        const client = testing.createRpcClient();

        // Test without authentication - should fail
        const controller = client.controller<SecureController>('secure');
        await expect(controller.getSecretData()).rejects.toThrow();

        // Test with valid token
        await client.authenticate('valid-token');
        const data = await controller.getSecretData();
        expect(data).toEqual({ secret: 'classified' });
    } finally {
        await testing.stopServer();
    }
});
```

## Testing Broker Functionality

Test message broker features:

```typescript
import { createTestingApp } from '@deepkit/framework';
import { BrokerBus, BrokerCache } from '@deepkit/broker';

test('broker messaging', async () => {
    const testing = createTestingApp({});

    const bus = testing.app.get(BrokerBus);
    const cache = testing.app.get(BrokerCache);

    // Test pub/sub
    const messages: any[] = [];
    const subscription = await bus.subscribe('test.channel');
    subscription.subscribe(msg => messages.push(msg));

    await bus.publish('test.channel', { content: 'Hello World' });

    // Wait for message processing
    await new Promise(resolve => setTimeout(resolve, 10));

    expect(messages).toHaveLength(1);
    expect(messages[0].content).toBe('Hello World');

    // Test cache
    await cache.set('test-key', { data: 'cached' }, 60);
    const cached = await cache.get('test-key');
    expect(cached).toEqual({ data: 'cached' });
});
```

## Testing Error Handling

Test error scenarios and edge cases:

```typescript
test('error handling', async () => {
    @rpc.controller('error-test')
    class ErrorController {
        @rpc.action()
        throwError() {
            throw new Error('Something went wrong');
        }

        @rpc.action()
        async asyncError() {
            throw new Error('Async error');
        }
    }

    const testing = createTestingApp({ controllers: [ErrorController] });
    await testing.startServer();

    try {
        const client = testing.createRpcClient();
        const controller = client.controller<ErrorController>('error-test');

        await expect(controller.throwError()).rejects.toThrow('Something went wrong');
        await expect(controller.asyncError()).rejects.toThrow('Async error');
    } finally {
        await testing.stopServer();
    }
});
```

## Best Practices

1. **Use `createTestingApp`** for integration tests
2. **Mock external dependencies** in unit tests
3. **Test both success and error scenarios**
4. **Use in-memory services** for fast tests
5. **Clean up resources** with try/finally blocks
6. **Test authentication and authorization**
7. **Verify logs and side effects**
8. **Use type-safe RPC testing**
9. **Test database operations** with entities
10. **Cover edge cases and error conditions**

## Test Organization

Organize your tests by feature:

```
tests/
├── unit/
│   ├── services/
│   │   ├── user.service.spec.ts
│   │   └── email.service.spec.ts
│   └── utils/
│       └── helpers.spec.ts
├── integration/
│   ├── http/
│   │   ├── user.controller.spec.ts
│   │   └── auth.controller.spec.ts
│   ├── rpc/
│   │   ├── user.rpc.spec.ts
│   │   └── notification.rpc.spec.ts
│   └── database/
│       └── user.repository.spec.ts
└── e2e/
    └── user-workflow.spec.ts
```

## Next Steps

- [Debugging](./debugging-profiling.md) - Debug and profile your tests
- [Database](./database.md) - Advanced database testing
- [RPC](./rpc.md) - Advanced RPC testing patterns
- [Performance](../performance.md) - Performance testing strategies
