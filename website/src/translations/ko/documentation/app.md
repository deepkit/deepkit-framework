# Deepkit App

Deepkit App 추상화는 Deepkit 애플리케이션의 가장 기본적인 구성 요소입니다. 라이브러리를 단독으로 사용하지 않는다면 보통 여기서 애플리케이션을 만들기 시작합니다.
이는 Node.js 같은 런타임으로 실행하는 일반적인 TypeScript 파일입니다. 애플리케이션의 진입점이며, CLI 명령, 서비스, 구성, 이벤트 등을 정의하는 방법을 제공합니다.

Command-line Interface(CLI) 프로그램은 텍스트 입력과 텍스트 출력을 통해 터미널로 상호작용하는 프로그램입니다. 이 방식의 장점은 로컬 또는 SSH 연결을 통해 터미널만 존재하면 된다는 점입니다.

제공 기능:

- CLI 명령
- 모듈 시스템
- 서비스 컨테이너
- 의존성 주입
- 이벤트 시스템
- 로거
- 설정 로더(env, dotenv, json)

Deepkit의 명령은 DI 컨테이너에 완전한 접근 권한을 가지며 모든 프로바이더와 구성 옵션에 접근할 수 있습니다. CLI 명령의 인수와 옵션은 TypeScript 타입을 통한 매개변수 선언으로 제어되며 자동으로 직렬화 및 검증됩니다.

`@deepkit/framework`를 사용하는 [Deepkit 프레임워크](./framework.md)는 이를 HTTP/RPC용 애플리케이션 서버, 디버거/프로파일러 등으로 확장합니다.

## 간편 설치

가장 쉬운 시작 방법은 NPM init을 사용해 새 Deepkit 프로젝트를 생성하는 것입니다.

```shell
npm init @deepkit/app@latest my-deepkit-app
````

이렇게 하면 모든 의존성과 기본 `app.ts` 파일이 포함된 새 폴더 `my-deepkit-app`가 생성됩니다.

```sh
cd my-deepkit-app
npm run app
````

이 명령은 `ts-node`로 `app.ts` 파일을 실행하고 사용 가능한 명령을 보여줍니다. 여기서부터 시작해 자신만의 명령, 컨트롤러 등을 추가할 수 있습니다.

## 수동 설치

Deepkit App은 [Deepkit 런타임 타입](./runtime-types.md)을 기반으로 하므로 모든 의존성을 설치합니다:

```bash
mkdir my-project && cd my-project

npm install typescript ts-node 
npm install @deepkit/app @deepkit/type @deepkit/type-compiler
```

다음 명령을 실행하여 Deepkit의 type compiler가 `node_modules/typescript`에 설치된 TypeScript 패키지에 설치되었는지 확인합니다:

```sh
./node_modules/.bin/deepkit-type-install
```

모든 peer dependency가 설치되었는지 확인하세요. 기본적으로 NPM 7+는 자동으로 설치합니다.

애플리케이션을 컴파일하려면 TypeScript 컴파일러가 필요하며, 앱을 쉽게 실행하기 위해 `ts-node` 사용을 권장합니다.

`ts-node`를 사용하지 않는 대안은 TypeScript 컴파일러로 소스 코드를 컴파일한 뒤 JavaScript 소스 코드를 직접 실행하는 것입니다. 이는 짧은 명령의 경우 실행 속도를 극적으로 높이는 장점이 있습니다. 그러나 컴파일러를 수동으로 실행하거나 watcher를 설정해야 하므로 워크플로에 추가 오버헤드가 생깁니다. 이런 이유로 이 문서의 모든 예제에서는 `ts-node`를 사용합니다.

## 첫 번째 애플리케이션

Deepkit 프레임워크는 구성 파일이나 특별한 폴더 구조를 사용하지 않으므로 프로젝트를 원하는 대로 구성할 수 있습니다. 시작하는 데 필요한 유일한 두 파일은 TypeScript app.ts 파일과 TypeScript 구성 파일 tsconfig.json입니다.

프로젝트 폴더에 다음 파일이 있도록 하는 것이 목표입니다:

```
.
├── app.ts
├── node_modules
├── package-lock.json
└── tsconfig.json
```

기본 tsconfig 파일을 설정하고 `reflection`을 `true`로 설정해 Deepkit의 type compiler를 활성화합니다.
이는 의존성 주입 컨테이너 및 기타 기능을 사용하기 위해 필요합니다.

```json title=tsconfig.json
{
  "compilerOptions": {
    "outDir": "./dist",
    "experimentalDecorators": true,
    "strict": true,
    "esModuleInterop": true,
    "target": "es2020",
    "module": "CommonJS",
    "moduleResolution": "node"
  },
  "reflection": true,
  "files": [
    "app.ts"
  ]
}
```

```typescript title=app.ts
import { App } from '@deepkit/app';
import { Logger } from '@deepkit/logger';

const app = new App();

app.command('test', (logger: Logger) => {
    logger.log('Hello World!');
});

app.run();
```

이 코드에서 테스트 명령을 정의하고 `run()`을 사용해 직접 실행하는 새 앱을 만든 것을 볼 수 있습니다. 이 스크립트를 실행하면 앱이 시작됩니다.

그리고 바로 실행합니다.

```sh
$ ./node_modules/.bin/ts-node app.ts
VERSION
  Node

USAGE
  $ ts-node app.ts [COMMAND]

TOPICS
  debug
  migration  Executes pending migration files. Use migration:pending to see which are pending.
  server     Starts the HTTP server

COMMANDS
  test
```

이제 테스트 명령을 실행하려면 다음 명령을 실행합니다.

```sh
$ ./node_modules/.bin/ts-node app.ts test
Hello World
```

Deepkit에서는 이제 모든 작업이 이 `app.ts`를 통해 수행됩니다. 파일 이름을 원하는 대로 바꾸거나 더 만들어도 됩니다. 사용자 정의 CLI 명령, HTTP/RPC 서버, 마이그레이션 명령 등은 모두 이 진입점에서 시작됩니다.

## 인수 및 플래그

Deepkit App은 Function 매개변수를 CLI 인수와 플래그로 자동 변환합니다. 매개변수의 순서는 CLI 인수의 순서를 결정합니다.

매개변수는 임의의 TypeScript 타입이 될 수 있으며 자동으로 검증되고 역직렬화됩니다.

자세한 내용은 [인수 및 플래그](./app/arguments.md) 장을 참조하세요.

## 의존성 주입

Deepkit App은 서비스 컨테이너를 설정하고, 가져온 각 모듈에 대해 상위로부터 상속되는 자체 의존성 주입 컨테이너를 만듭니다.
다음 프로바이더를 기본으로 제공하며, 서비스, 컨트롤러, 이벤트 리스너에 자동으로 주입할 수 있습니다:

- `Logger` 로그용
- `EventDispatcher` 이벤트 처리용
- `CliControllerRegistry` 등록된 CLI 명령용
- `MiddlewareRegistry` 등록된 미들웨어용
- `InjectorContext` 현재 인젝터 컨텍스트용

Deepkit 프레임워크를 가져오면 추가 프로바이더를 사용할 수 있습니다. 자세한 내용은 [Deepkit 프레임워크](./framework.md)를 참조하세요.

## 종료 코드

종료 코드는 기본적으로 0이며, 이는 명령이 성공적으로 실행되었음을 의미합니다. 종료 코드를 변경하려면 execute 메서드 또는 명령 콜백에서 0이 아닌 숫자를 반환해야 합니다.

```typescript

@cli.controller('test')
export class TestCommand {
    async execute() {
        console.error('Error :(');
        return 12;
    }
}
```