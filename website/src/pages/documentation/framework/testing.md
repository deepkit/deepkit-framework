# Testing

The services and controllers in the Deepkit framework are designed to support SOLID and clean code that is well-designed, encapsulated, and separated. These features make the code easy to test.

This documentation shows you how to set up a testing framework named [Jest](https://jestjs.io) with `ts-jest`. To do this, run the following command to install `jest` and `ts-jest`.

```sh
npm install jest ts-jest @types/jest
```

Jest needs a few configuration options to know where to find the test suits and how to compile the TS code. Add the following configuration to your `package.json`:

```json title=package.json
{
  ...,

  "jest": {
    "transform": {
      "^.+\\.(ts|tsx)$": "ts-jest"
    },
    "testEnvironment": "node",
    "testMatch": [
      "**/*.spec.ts"
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

## Unit Test

Whenever possible, you should unit test your services. The simpler, better separated, and better defined your service dependencies are, the easier it is to test them. In this case, you can write simple tests like the following:

```typescript
export class MyService {
    helloWorld() {
        return 'hello world';
    }
}
```

```typescript
//
import { MyService } from './my-service.ts';

test('hello world', () => {
    const myService = new MyService();
    expect(myService.helloWorld()).toBe('hello world');
});
```

## Integration tests

It's not always possible to write unit tests, nor is it always the most efficient way to cover business-critical code and behavior. Especially if your architecture is very complex, it is beneficial to be able to easily perform end-to-end integration tests.

As you have already learned in the Dependency Injection chapter, the Dependency Injection Container is the heart of Deepkit. This is where all services are built and run. Your application defines services (providers), controllers, listeners, and imports. For integration testing, you don't necessarily want to have all services available in a test case, but you usually want to have a stripped down version of the application available to test the critical areas.

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
