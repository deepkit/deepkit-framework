# 测试

Deepkit 框架中的服务和控制器旨在支持 SOLID 和简洁的代码，具有良好的设计、封装和分离。这些特性使代码易于测试。

本文档将向你展示如何使用 `ts-jest` 设置名为 [Jest](https://jestjs.io) 的测试框架。为此，运行以下命令安装 `jest` 和 `ts-jest`。

```sh
npm install jest ts-jest @types/jest
```

Jest 需要一些配置选项来知道从哪里查找测试套件以及如何编译 TS 代码。将以下配置添加到你的 `package.json`：

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

你的测试文件应命名为 `.spec.ts`。创建一个 `test.spec.ts` 文件，并写入以下内容。

```typescript
test('first test', () => {
    expect(1 + 1).toBe(2);
});
```

现在你可以使用 jest 命令一次性运行所有测试套件。

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

请阅读 [Jest-Dokumentation](https://jestjs.io) 以了解更多关于 Jest CLI 工具的工作方式，以及如何编写更复杂的测试和完整的测试套件。

## 单元测试

在可能的情况下，你应该为你的服务编写单元测试。你的服务依赖越简单、分离越好、定义越清晰，就越容易对其进行测试。在这种情况下，你可以编写如下简单测试：

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

## 集成测试

并非总是可以编写单元测试，也并非总是用单元测试覆盖业务关键代码和行为的最高效方式。特别是当你的架构非常复杂时，能够轻松地执行端到端的集成测试将非常有益。

正如你在依赖注入章节中已经了解到的那样，依赖注入容器是 Deepkit 的核心。所有服务都在这里构建并运行。你的应用定义了服务（providers）、控制器、监听器和 imports。对于集成测试，你不一定希望在一个测试用例中拥有所有服务，但通常希望有一个精简版的应用来测试关键区域。

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

    // 访问依赖注入容器并实例化 MyService
    const myService = testing.app.get(MyService);

    expect(myService.helloWorld()).toBe('hello world');
});
```

如果你已将应用拆分为多个模块，你可以更轻松地测试它们。例如，假设你创建了一个 `AppCoreModule` 并希望测试一些服务。

```typescript
class Config {
    items: number = 10;
}

export class MyService {
    constructor(protected items: Config['items']) {

    }

    doIt(): boolean {
        // 做点什么
        return true;
    }
}

export AppCoreModule = new AppModule({}, {
    config: config,
    provides: [MyService]
}, 'core');
```

你可以如下使用你的模块：

```typescript
import { AppCoreModule } from './app-core.ts';

new App({
    imports: [new AppCoreModule]
}).run();
```

并且在不启动整个应用服务器的情况下测试它。

```typescript
import { createTestingApp } from '@deepkit/framework';
import { AppCoreModule, MyService } from './app-core.ts';

test('service simple', async () => {
    const testing = createTestingApp({ imports: [new AppCoreModule] });

    const myService = testing.app.get(MyService);
    expect(myService.doIt()).toBe(true);
});

test('service simple big', async () => {
    // 针对特定测试场景更改模块的配置
    const testing = createTestingApp({
        imports: [new AppCoreModule({items: 100})]
    });

    const myService = testing.app.get(MyService);
    expect(myService.doIt()).toBe(true);
});
```