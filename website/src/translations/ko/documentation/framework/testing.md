# 테스트

Deepkit framework의 services와 controllers는 SOLID와 clean code 원칙을 따르며, 잘 설계되고 캡슐화되어 분리된 구조를 지원하도록 설계되었습니다. 이러한 특징은 코드를 테스트하기 쉽게 만듭니다.

이 문서는 `ts-jest`와 함께 [Jest](https://jestjs.io)라는 테스트 프레임워크를 설정하는 방법을 보여줍니다. 이를 위해 다음 명령어를 실행해 `jest`와 `ts-jest`를 설치하세요.

```sh
npm install jest ts-jest @types/jest
```

Jest는 테스트 스위트를 어디에서 찾고 TS 코드를 어떻게 컴파일할지 알기 위해 몇 가지 설정이 필요합니다. `package.json`에 다음 설정을 추가하세요:

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

테스트 파일 이름은 `.spec.ts`여야 합니다. 다음 내용으로 `test.spec.ts` 파일을 만드세요.

```typescript
test('first test', () => {
    expect(1 + 1).toBe(2);
});
```

이제 jest 명령어로 모든 테스트 스위트를 한 번에 실행할 수 있습니다.

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

Jest CLI 도구가 어떻게 동작하는지와 더 정교한 테스트 및 전체 테스트 스위트를 작성하는 방법을 알아보려면 [Jest 문서](https://jestjs.io)를 읽어보세요.

## 단위 테스트

가능하다면 services를 단위 테스트해야 합니다. 서비스 의존성이 단순하고, 더 잘 분리되어 있으며, 더 명확하게 정의될수록 테스트가 쉬워집니다. 이런 경우 다음과 같은 간단한 테스트를 작성할 수 있습니다:

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

## 통합 테스트

항상 단위 테스트를 작성할 수 있는 것도 아니고, 항상 비즈니스 크리티컬한 코드와 동작을 커버하는 가장 효율적인 방법인 것도 아닙니다. 특히 아키텍처가 매우 복잡한 경우에는 end-to-end 통합 테스트를 쉽게 수행할 수 있는 것이 유리합니다.

Dependency Injection 장에서 이미 배웠듯이, Dependency Injection Container는 Deepkit의 핵심입니다. 이곳에서 모든 services가 빌드되고 실행됩니다. 애플리케이션은 services(providers), controllers, listeners, 그리고 imports를 정의합니다. 통합 테스트에서는 테스트 케이스에서 모든 services를 사용할 필요는 없고, 보통은 핵심 영역을 테스트할 수 있도록 애플리케이션의 축소판 버전을 사용하고자 합니다.

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

    // Dependency Injection 컨테이너에 접근하여 MyService를 인스턴스화합니다
    const myService = testing.app.get(MyService);

    expect(myService.helloWorld()).toBe('hello world');
});
```

애플리케이션을 여러 모듈로 나눴다면 더 쉽게 테스트할 수 있습니다. 예를 들어 `AppCoreModule`을 만들었고 몇몇 services를 테스트하고 싶다고 가정해봅시다.

```typescript
class Config {
    items: number = 10;
}

export class MyService {
    constructor(protected items: Config['items']) {

    }

    doIt(): boolean {
        // 무언가 수행
        return true;
    }
}

export AppCoreModule = new AppModule({}, {
    config: config,
    provides: [MyService]
}, 'core');
```

모듈은 다음과 같이 사용합니다:

```typescript
import { AppCoreModule } from './app-core.ts';

new App({
    imports: [new AppCoreModule]
}).run();
```

그리고 전체 애플리케이션 서버를 부팅하지 않고 테스트합니다.

```typescript
import { createTestingApp } from '@deepkit/framework';
import { AppCoreModule, MyService } from './app-core.ts';

test('service simple', async () => {
    const testing = createTestingApp({ imports: [new AppCoreModule] });

    const myService = testing.app.get(MyService);
    expect(myService.doIt()).toBe(true);
});

test('service simple big', async () => {
    // 특정 테스트 시나리오를 위해 모듈의 설정을 변경합니다
    const testing = createTestingApp({
        imports: [new AppCoreModule({items: 100})]
    });

    const myService = testing.app.get(MyService);
    expect(myService.doIt()).toBe(true);
});
```