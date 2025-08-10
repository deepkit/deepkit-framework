# 설정

Deepkit 애플리케이션에서 모듈과 애플리케이션은 설정 옵션을 가질 수 있습니다.
예를 들어, 설정은 데이터베이스 URL, 비밀번호, IP 등으로 구성될 수 있습니다. 서비스, HTTP/RPC/CLI 컨트롤러, 템플릿 함수는 의존성 주입을 통해 이러한 설정 옵션을 읽을 수 있습니다.

설정은 프로퍼티를 가진 클래스를 정의하여 지정할 수 있습니다. 이는 애플리케이션 전체의 설정을 타입 안전하게 정의하는 방법이며, 값은 자동으로 직렬화되고 검증됩니다.

## 예제

```typescript
import { MinLength } from '@deepkit/type';
import { App } from '@deepkit/app';

class Config {
    pageTitle: string & MinLength<2> = 'Cool site';
    domain: string = 'example.com';
    debug: boolean = false;
}

const app = new App({
    config: Config
});


app.command('print-config', (config: Config) => {
    console.log('config', config);
})

app.run();
```

```sh
$ curl http://localhost:8080/
Hello from Cool site via example.com
```

설정 로더가 사용되지 않으면 기본값이 사용됩니다. 설정을 변경하려면 `app.configure({domain: 'localhost'})` 메서드를 사용하거나 환경 설정 로더를 사용할 수 있습니다.

## 설정 값 설정

기본적으로 값은 덮어쓰지 않으므로 기본값이 사용됩니다. 설정 값을 지정하는 방법은 여러 가지가 있습니다.

* `app.configure({})`를 통해
* 각 옵션에 대한 환경 변수
* JSON을 통한 환경 변수
* dotenv 파일

여러 방법을 동시에 사용해 설정을 로드할 수 있습니다. 호출 순서가 중요합니다.

### 환경 변수

각 설정 옵션을 자체 환경 변수로 설정할 수 있도록 하려면 `loadConfigFromEnv`를 사용합니다. 기본 접두사는 `APP_`이지만 변경할 수 있습니다. 또한 `.env` 파일을 자동으로 로드합니다. 기본적으로 대문자 명명 전략을 사용하지만, 이 또한 변경할 수 있습니다.

위의 `pageTitle`과 같은 설정 옵션의 값을 변경하려면 `APP_PAGE_TITLE="Other Title"`을 사용할 수 있습니다.

```typescript
new App({
    config: config,
    controllers: [MyWebsite],
})
    .loadConfigFromEnv({prefix: 'APP_'})
    .run();
```

```sh
APP_PAGE_TITLE="Other title" ts-node app.ts server:start
```

### JSON 환경 변수

하나의 환경 변수로 여러 설정 옵션을 변경하려면 `loadConfigFromEnvVariable`을 사용합니다. 첫 번째 인수는 환경 변수의 이름입니다.

```typescript
new App({
    config: config,
    controllers: [MyWebsite],
})
    .loadConfigFromEnvVariable('APP_CONFIG')
    .run();
```

```sh
APP_CONFIG='{"pageTitle": "Other title"}' ts-node app.ts server:start
```

### DotEnv 파일

dotenv 파일을 통해 여러 설정 옵션을 변경하려면 `loadConfigFromEnv`를 사용합니다. 첫 번째 인수는 dotenv의 경로(`cwd` 기준) 또는 여러 경로입니다. 배열인 경우, 존재하는 파일이 발견될 때까지 각 경로를 시도합니다.

```typescript
new App({
    config: config,
    controllers: [MyWebsite],
})
    .loadConfigFromEnv({envFilePath: ['production.dotenv', 'dotenv']})
    .run();
```

```sh
$ cat dotenv
APP_PAGE_TITLE=Other title
$ ts-node app.ts server:start
```

### 모듈 설정

가져온 각 모듈은 모듈 이름을 가질 수 있습니다. 이 이름은 위에서 사용한 설정 경로에 사용됩니다.

예를 들어, 환경 변수를 통한 설정에서 `FrameworkModule`의 옵션 port에 대한 경로는 `FRAMEWORK_PORT`입니다. 모든 이름은 기본적으로 대문자로 작성됩니다. 접두사 `APP_`가 사용되면 포트는 다음과 같이 변경할 수 있습니다.

```sh
$ APP_FRAMEWORK_PORT=9999 ts-node app.ts server:start
2021-06-12T18:59:26.363Z [LOG] Start HTTP server, using 1 workers.
2021-06-12T18:59:26.365Z [LOG] HTTP MyWebsite
2021-06-12T18:59:26.366Z [LOG]     GET / helloWorld
2021-06-12T18:59:26.366Z [LOG] HTTP listening at http://localhost:9999/
```

dotenv 파일에서도 `APP_FRAMEWORK_PORT=9999`가 됩니다.

반면에 `loadConfigFromEnvVariable('APP_CONFIG')`를 통한 JSON 환경 변수에서는 실제 설정 클래스의 구조를 따릅니다. `framework`는 객체가 됩니다.

```sh
$ APP_CONFIG='{"framework": {"port": 9999}}' ts-node app.ts server:start
```

이는 모든 모듈에 대해 동일하게 작동합니다. 애플리케이션 설정 옵션(`new App`)에는 모듈 접두사가 필요하지 않습니다.


## 설정 클래스

```typescript
import { MinLength } from '@deepkit/type';

export class Config {
    title!: string & MinLength<2>; //필수 항목이 되며 값을 제공해야 합니다
    host?: string;

    debug: boolean = false; //기본값도 지원됩니다
}
```

```typescript
import { createModuleClass } from '@deepkit/app';
import { Config } from './module.config.ts';

export class MyModule extends createModuleClass({
  config: Config
}) {
}
```

설정 옵션의 값은 모듈의 생성자에서, `.configure()` 메서드를 통해, 또는 설정 로더(예: 환경 변수 로더)를 통해 제공될 수 있습니다.

```typescript
import { MyModule } from './module.ts';

new App({
   imports: [new MyModule({title: 'Hello World'})],
}).run();
```

가져온 모듈의 설정 옵션을 동적으로 변경하려면 `process` 훅을 사용할 수 있습니다. 이는 현재 모듈 설정 또는 다른 모듈 인스턴스 정보에 따라 설정 옵션을 전달하거나 가져온 모듈을 설정하기에 좋은 위치입니다.

```typescript
import { MyModule } from './module.ts';

export class MainModule extends createModuleClass({
}) {
    process() {
        this.getImportedModuleByClass(MyModule).configure({title: 'Changed'});
    }
}
```

애플리케이션 수준에서는 약간 다르게 동작합니다:

```typescript
new App({
    imports: [new MyModule({title: 'Hello World'}],
})
    .setup((module, config) => {
        module.getImportedModuleByClass(MyModule).configure({title: 'Changed'});
    })
    .run();
```

루트 애플리케이션 모듈이 일반 모듈에서 만들어진 경우에도, 일반 모듈과 유사하게 동작합니다.

```typescript
class AppModule extends createModuleClass({
}) {
    process() {
        this.getImportedModuleByClass(MyModule).configure({title: 'Changed'});
    }
}

App.fromModule(new AppModule()).run();
```

## 설정 값 읽기

서비스에서 설정 옵션을 사용하려면 일반적인 의존성 주입을 사용할 수 있습니다. 전체 설정 객체, 단일 값, 또는 설정의 일부만 주입하는 것이 가능합니다.

### 부분

설정 값의 하위 집합만 주입하려면 `Pick` 타입을 사용합니다.

```typescript
import { Config } from './module.config';

export class MyService {
     constructor(private config: Pick<Config, 'title' | 'host'}) {
     }

     getTitle() {
         return this.config.title;
     }
}


//단위 테스트에서는 다음과 같이 인스턴스화할 수 있습니다
new MyService({title: 'Hello', host: '0.0.0.0'});

//또는 타입 별칭을 사용할 수 있습니다
type MyServiceConfig = Pick<Config, 'title' | 'host'};
export class MyService {
     constructor(private config: MyServiceConfig) {
     }
}
```

### 단일 값

단일 값만 주입하려면 인덱스 접근 연산자를 사용합니다.

```typescript
import { Config } from './module.config';

export class MyService {
     constructor(private title: Config['title']) {
     }

     getTitle() {
         return this.title;
     }
}
```

### 전체

모든 설정 값을 주입하려면 클래스를 의존성으로 사용합니다.

```typescript
import { Config } from './module.config';

export class MyService {
     constructor(private config: Config) {
     }

     getTitle() {
         return this.config.title;
     }
}
```