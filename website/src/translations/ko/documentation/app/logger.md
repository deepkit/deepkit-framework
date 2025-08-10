# 로거

Deepkit Logger는 정보를 로깅하는 데 사용할 수 있는 기본 Logger 클래스를 포함한 독립 실행형 라이브러리입니다. 이 클래스는 Deepkit 애플리케이션의 의존성 주입(Dependency Injection) 컨테이너에서 자동으로 사용 가능합니다.

`Logger` 클래스에는 여러 메서드가 있으며, 각각은 `console.log`와 동일하게 동작합니다.

| 이름             | 로그 레벨            | 레벨 ID |
|------------------|----------------------|---------|
| logger.error()   | 오류                 | 1       |
| logger.warning() | 경고                 | 2       |
| logger.log()     | 기본 로그            | 3       |
| logger.info()    | 특별 정보            | 4       |
| logger.debug()   | 디버그 정보          | 5       |


기본적으로 로거는 `info` 레벨을 가지며, 즉 info 메시지 이상만 처리합니다(즉, log, warning, error는 처리하지만 debug는 처리하지 않음). 로그 레벨을 변경하려면 예를 들어 `logger.level = 5`를 호출하세요.

## 애플리케이션에서 사용

Deepkit 애플리케이션에서 로거를 사용하려면 서비스나 컨트롤러에 `Logger`를 간단히 주입하면 됩니다.

```typescript
import { Logger } from '@deepkit/logger';
import { App } from '@deepkit/app';

const app = new App();
app.command('test', (logger: Logger) => {
    logger.log('This is a <yellow>log message</yellow>');
});

app.run();
```

## 색상

로거는 컬러 로그 메시지를 지원합니다. 컬러로 표시하려는 텍스트를 감싸는 XML 태그를 사용하여 색상을 지정할 수 있습니다.

```typescript
const username = 'Peter';
logger.log(`Hi <green>${username}</green>`);
```

색상을 지원하지 않는 트랜스포터의 경우 색상 정보는 자동으로 제거됩니다. 기본 트랜스포터(`ConsoleTransport`)에서는 색상이 표시됩니다. 다음 색상을 사용할 수 있습니다: `black`, `red`, `green`, `blue`, `cyan`, `magenta`, `white`, `grey`/`gray`.

## 트랜스포터

하나의 트랜스포터 또는 여러 트랜스포터를 구성할 수 있습니다. Deepkit 애플리케이션에서는 `ConsoleTransport` 트랜스포터가 자동으로 구성됩니다. 추가 트랜스포터를 구성하려면 [설정 호출](dependency-injection.md#di-setup-calls)을 사용하세요:

```typescript
import { Logger, LoggerTransport } from '@deepkit/logger';

export class MyTransport implements LoggerTransport {
    write(message: string, level: LoggerLevel, rawMessage: string) {
        process.stdout.write(JSON.stringify({message: rawMessage, level, time: new Date}) + '\n');
    }

    supportsColor() {
        return false;
    }
}

new App()
    .setup((module, config) => {
        module.configureProvider<Logger>(v => v.addTransport(new MyTransport));
    })
    .run();
```

모든 트랜스포터를 새로운 트랜스포터 집합으로 교체하려면 `setTransport`를 사용하세요:

```typescript
import { Logger } from '@deepkit/logger';

new App()
.setup((module, config) => {
    module.configureProvider<Logger>(v => v.setTransport([new MyTransport]));
})
.run();
```

```typescript
import { Logger, JSONTransport } from '@deepkit/logger';

new App()
    .setup((module, config) => {
        module.configureProvider<Logger>(v => v.setTransport([new JSONTransport]));
    })
    .run();
```

## 스코프드 로거

스코프드 로거는 각 로그 항목에 임의의 영역 이름을 추가하여, 해당 로그 항목이 애플리케이션의 어떤 하위 영역에서 발생했는지 파악하는 데 도움이 됩니다.

```typescript
const scopedLogger = logger.scoped('database');
scopedLogger.log('Query', query);
```

서비스에 스코프드 로거를 주입할 때 사용할 수 있는 `ScopedLogger` 타입도 있습니다.

```typescript
import { ScopedLogger } from '@deepkit/logger';

class MyService {
    constructor(protected logger: ScopedLogger) {}
    doSomething() {
        this.logger.log('This is wild');
    }
}
```

이제 스코프드 로거의 모든 메시지에는 `MyService` 스코프 이름이 접두사로 붙습니다.

## 포맷터

포맷터를 사용하면 메시지 형식을 변경할 수 있으며, 예를 들어 타임스탬프를 추가할 수 있습니다. 애플리케이션이 `server:start`로 시작될 때 다른 포맷터가 없으면 `DefaultFormatter`가 자동으로 추가됩니다(타임스탬프, 범위, 로그 레벨을 추가).

## 컨텍스트 데이터

로그 항목에 컨텍스트 데이터를 추가하려면 마지막 인자로 간단한 객체 리터럴을 추가하세요. 최소 두 개 이상의 인자를 가진 로그 호출만 컨텍스트 데이터를 포함할 수 있습니다.

```typescript
const query = 'SELECT *';
const user = new User;
logger.log('Query', {query, user}); // 마지막 인자는 컨텍스트 데이터
logger.log('Another', 'wild log entry', query, {user}); // 마지막 인자는 컨텍스트 데이터

logger.log({query, user}); // 이는 컨텍스트 데이터로 처리되지 않습니다.
```