# 모듈

Deepkit은 고도로 모듈화되어 있어 애플리케이션을 여러 유용한 모듈로 쉽게 분할할 수 있습니다. 각 모듈은 자체 의존성 주입 하위 컨테이너(모든 상위 provider를 상속), 구성(configuration), 명령(commands) 등을 가집니다.
[시작하기](../framework.md) 장에서 이미 하나의 모듈(루트 모듈)을 만들었습니다. `new App`은 모듈과 거의 동일한 인자를 받는데, 이는 백그라운드에서 자동으로 루트 모듈을 생성하기 때문입니다.

애플리케이션을 서브 모듈로 분할할 계획이 없거나, 모듈을 패키지로 만들어 다른 사람에게 제공할 계획이 없다면 이 장은 건너뛰어도 됩니다.

모듈은 클래스 모듈 또는 함수형 모듈로 정의할 수 있습니다.

```typescript title=클래스 모듈
import { createModuleClass } from '@deepkit/app';

export class MyModule extends createModuleClass({
  //new App({})와 동일한 옵션
  providers: [MyService]
}) {
}
```

```typescript title=함수형 모듈
import { AppModule } from '@deepkit/app';

export function myModule(options: {} = {}) {
    return (module: AppModule) => {
        module.addProvider(MyService);
    };
}
```

이 모듈은 애플리케이션이나 다른 모듈에 가져와(import) 사용할 수 있습니다.

```typescript
import { MyModule, myModule } from './module.ts'

new App({
    imports: [
        new MyModule(), //클래스 모듈 import
        myModule(), //함수형 모듈 import
    ]
}).run();
```

이제 `App`과 동일하게 이 모듈에 기능을 추가할 수 있습니다. `createModule`의 인자는 동일하지만, 모듈 정의에서는 imports를 사용할 수 없습니다.
함수형 라우트의 경우 `AppModule`의 메서드를 사용하여 자체 옵션에 따라 동적으로 구성할 수 있습니다.

HTTP/RPC/CLI 컨트롤러, 서비스, 구성, 이벤트 리스너 및 다양한 모듈 훅을 추가하여 모듈을 더욱 동적으로 만드세요.

## 컨트롤러

모듈은 다른 모듈에 의해 처리되는 컨트롤러를 정의할 수 있습니다. 예를 들어 `@deepkit/http` 패키지의 데코레이터가 있는 컨트롤러를 추가하면, 해당 `HttpModule` 모듈이 이를 감지하여 라우터에 발견된 라우트를 등록합니다. 하나의 컨트롤러에는 이러한 데코레이터가 여러 개 있을 수 있습니다. 이러한 데코레이터를 제공하는 모듈 작성자가 컨트롤러를 어떻게 처리할지는 그에게 달려 있습니다.

Deepkit에는 이러한 컨트롤러를 처리하는 세 가지 패키지(HTTP, RPC, CLI)가 있습니다. 자세한 내용은 각 장을 참고하세요. 아래는 HTTP 컨트롤러의 예시입니다:

```typescript
import { createModuleClass } from '@deepkit/app';
import { http } from '@deepkit/http';
import { injectable } from '@deepkit/injector';

class MyHttpController {
  @http.GET('/hello)
  hello() {
    return 'Hello world!';
  }
}

export class MyModule extends createModuleClass({
  controllers: [MyHttpController]
}) {
}


//App에서도 동일하게 가능
new App({
  controllers: [MyHttpController]
}).run();
```

## Provider

애플리케이션의 `providers` 섹션에 provider를 정의하면 애플리케이션 전반에서 접근할 수 있습니다. 그러나 모듈의 경우 이러한 provider는 해당 모듈의 의존성 주입 하위 컨테이너에 자동으로 캡슐화됩니다. 다른 모듈이나 애플리케이션에서 사용할 수 있도록 하려면 각 provider를 수동으로 export해야 합니다.

provider 동작에 대해 더 알아보려면 [의존성 주입](../dependency-injection.md) 장을 참조하세요.

```typescript
import { createModuleClass } from '@deepkit/app';
import { http } from '@deepkit/http';
import { injectable } from '@deepkit/injector';

export class HelloWorldService {
  helloWorld() {
    return 'Hello there!';
  }
}

class MyHttpController {
  constructor(private helloService: HelloWorldService) {
  }

  @http.GET('/hello)
  hello() {
    return this.helloService.helloWorld();
  }
}

export class MyModule extends createModuleClass({
  controllers: [MyHttpController],
  providers: [HelloWorldService],
}) {
}

export function myModule(options: {} = {}) {
  return (module: AppModule) => {
    module.addController(MyHttpController);
    module.addProvider(HelloWorldService);
  };
}

//App에서도 동일하게 가능
new App({
  controllers: [MyHttpController],
  providers: [HelloWorldService],
}).run();
```

사용자가 이 모듈을 import하더라도, `MyModule`의 하위 의존성 주입 컨테이너에 캡슐화되어 있기 때문에 `HelloWorldService`에 접근할 수 없습니다.

## 내보내기

import하는 쪽의 모듈에서 provider를 사용할 수 있도록 하려면 `exports`에 provider의 토큰을 포함하면 됩니다. 이는 본질적으로 provider를 한 단계 위로, 즉 상위 모듈(가져오는 쪽)의 의존성 주입 컨테이너로 이동시킵니다.

```typescript
import { createModuleClass } from '@deepkit/app';

export class MyModule extends createModuleClass({
  exports: [HelloWorldService],
}) {
}

export function myModule(options: {} = {}) {
  return (module: AppModule) => {
    module.addExport(HelloWorldService);
  };
}
```

`FactoryProvider`, `UseClassProvider` 등 다른 provider를 사용하는 경우에도, exports에는 클래스 타입만 사용해야 합니다.

```typescript
import { createModuleClass } from '@deepkit/app';

export class MyModule extends createModuleClass({
  controllers: [MyHttpController]
  providers: [
    { provide: HelloWorldService, useValue: new HelloWorldService }
  ],
  exports: [HelloWorldService],
}) {
}
```

이제 해당 모듈을 import하고, 애플리케이션 코드에서 export된 서비스를 사용할 수 있습니다.

```typescript
import { App } from '@deepkit/app';
import { cli, Command } from '@deepkit/app';
import { HelloWorldService, MyModule } from './my-module';

@cli.controller('test')
export class TestCommand implements Command {
    constructor(protected helloWorld: HelloWorldService) {
    }

    async execute() {
        this.helloWorld.helloWorld();
    }
}

new App({
    controllers: [TestCommand],
    imports: [
        new MyModule(),
    ]
}).run();
```

자세한 내용은 [의존성 주입](../dependency-injection.md) 장을 참조하세요.


### 구성 스키마

모듈은 타입 안전한 구성 옵션을 가질 수 있습니다. 이 옵션 값은 클래스 참조 또는 `Partial<Config, 'url'>` 같은 타입 함수만으로 해당 모듈의 서비스에 부분적으로 또는 완전히 주입할 수 있습니다. 구성 스키마를 정의하려면 프로퍼티가 있는 클래스를 작성하세요.

```typescript
export class Config {
    title!: string; //필수이며 제공되어야 함
    host?: string; //옵션

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

export function myModule(options: Partial<Config> = {}) {
  return (module: AppModule) => {
    module.setConfigDefinition(Config).configure(options);
  };
}
```

구성 옵션 값은 모듈의 생성자, `.configure()` 메서드, 또는 구성 로더(예: 환경 변수 로더)를 통해 제공할 수 있습니다.

```typescript
import { MyModule } from './module.ts';

new App({
   imports: [
       new MyModule({title: 'Hello World'}),
       myModule({title: 'Hello World'}),
   ],
}).run();
```

import된 모듈의 구성 옵션을 동적으로 변경하려면 `process` 모듈 훅을 사용할 수 있습니다. 이는 구성 옵션을 전달하거나, 현재 모듈의 구성 또는 다른 모듈 인스턴스 정보에 따라 import된 모듈을 설정하기에 좋은 위치입니다.


```typescript
import { MyModule } from './module.ts';

export class MainModule extends createModuleClass({
}) {
    process() {
        this.getImportedModuleByClass(MyModule).configure({title: 'Changed'});
    }
}

export function myModule(options: Partial<Config> = {}) {
    return (module: AppModule) => {
        module.getImportedModuleByClass(MyModule).configure({title: 'Changed'});
    };
}
```

애플리케이션 레벨에서는 약간 다르게 동작합니다:

```typescript
new App({
    imports: [new MyModule({title: 'Hello World'}],
})
    .setup((module, config) => {
        module.getImportedModuleByClass(MyModule).configure({title: 'Changed'});
    })
    .run();
```

루트 애플리케이션 모듈이 일반 모듈에서 생성된 경우, 일반 모듈과 유사하게 동작합니다.

```typescript
class AppModule extends createModuleClass({
}) {
    process() {
        this.getImportedModuleByClass(MyModule).configure({title: 'Changed'});
    }
}

App.fromModule(new AppModule()).run();
```

## 모듈 이름

모든 구성 옵션은 환경 변수를 통해서도 변경할 수 있습니다. 이는 모듈에 이름이 할당된 경우에만 동작합니다. 모듈 이름은 `createModule`을 통해 정의할 수 있으며, 인스턴스 생성 시점에 동적으로 변경할 수도 있습니다. 후자의 패턴은 동일한 모듈을 두 번 import하고 각각을 구분하고자 할 때 유용합니다.

```typescript
export class MyModule extends createModuleClass({
  name: 'my'
}) {
}

export function myModule(options: Partial<Config> = {}) {
    return (module: AppModule) => {
        module.name = 'my';
    };
}
```

```typescript
import { MyModule } from './module';

new App({
    imports: [
        new MyModule(), //'my'가 기본 이름
        new MyModule().rename('my2'), //'my2'가 새로운 이름
    ]
}).run();
```

환경 변수 또는 .env 파일에서 구성 옵션을 로드하는 방법에 대한 자세한 내용은 [구성](./configuration.md) 장을 참고하세요.

## Imports

모듈은 다른 모듈을 import하여 기능을 확장할 수 있습니다. `App`에서는 모듈 정의 객체의 `imports: []`를 통해 다른 모듈을 import할 수 있습니다:

```typescript
new App({
    imports: [new Module]
}).run();
```

일반 모듈에서는 객체 정의에 인스턴스를 넣으면 전역이 되어버리므로(보통 원치 않는 동작) 이 방식이 불가능합니다. 대신, 모듈 자체의 `imports` 프로퍼티를 통해 모듈 내에서 인스턴스를 생성하여, 모듈의 각 새 인스턴스마다 import된 모듈의 인스턴스가 생성되도록 할 수 있습니다.

```typescript
import { createModuleClass } from '@deepkit/app';

export class MyModule extends createModuleClass({}) {
  imports = [new OtherModule()];
}

export function myModule() {
  return (module: AppModule) => {
    module.addImport(new OtherModule());
  };
}
```

`process` 훅을 사용하여 구성에 따라 모듈을 동적으로 import할 수도 있습니다.

```typescript
import { createModuleClass } from '@deepkit/app';

export class MyModule extends createModuleClass({}) {
  process() {
    if (this.config.xEnabled) {
      this.addImport(new OtherModule({ option: 'value' });
    }
  }
}

export function myModule(option: { xEnabled?: boolean } = {}) {
  return (module: AppModule) => {
    if (option.xEnabled) {
      module.addImport(new OtherModule());
    }
  };
}
```

## 훅(Hooks)

서비스 컨테이너는 루트/애플리케이션 모듈부터 시작하여 import된 순서대로 모든 모듈을 로드합니다.

이 과정에서 서비스 컨테이너는 등록된 모든 구성 로더를 실행하고, `setupConfig` 콜백을 호출하며, 각 모듈의 구성 객체를 검증합니다.

서비스 컨테이너 로딩의 전체 과정은 다음과 같습니다:

1.  각 모듈 `T`에 대해(루트부터 시작)
    1. 구성 로더 `ConfigLoader.load(T)` 실행.
    2. `T.setupConfig()` 호출.
    3. `T`의 구성 검증. 유효하지 않으면 중단.
    4. `T.process()` 호출.  
       여기서 모듈은 유효한 구성 옵션에 따라 자신을 수정할 수 있습니다. 새로운 import, provider 등을 추가합니다.
    5. `T`의 각 import된 모듈에 대해 1. 반복.
3. 등록된 모든 모듈 검색.
4. 발견된 각 모듈 `T`를 처리.
    1. `T`의 미들웨어 등록.
    2. 이벤트 디스패처에 `T`의 리스너 등록.
    3. 2.에서 발견된 모든 모듈에 대해 `Module.processController(T, controller)` 호출.
    4. 2.에서 발견된 모든 모듈에 대해 `Module.processProvider(T, token, provider)` 호출.
    5. `T`의 각 import된 모듈에 대해 3. 반복.
5. 모든 모듈에 대해 `T.postProcess()` 실행.
6. 모든 모듈에서 bootstrap 클래스 인스턴스화.
7. 의존성 주입 컨테이너가 이제 빌드됨.

훅을 사용하려면 모듈 클래스에서 `process`, `processProvider`, `postProcess` 메서드를 등록하면 됩니다.

```typescript
import { createModuleClass, AppModule } from '@deepkit/app';
import { isClass } from '@deepkit/core';
import { ProviderWithScope, Token } from '@deepkit/injector';

export class MyModule extends createModuleClass({}) {
  imports = [new FrameworkModule()];

  //먼저 실행됨
  process() {
    //this.config에는 완전히 검증된 구성 객체가 들어 있습니다.
    if (this.config.environment === 'development') {
      this.getImportedModuleByClass(FrameworkModule).configure({ debug: true });
    }
    this.addModule(new AnotherModule);
    this.addProvider(Service);

    //추가 설정 메서드를 호출합니다.
    //이 경우 의존성 주입 컨테이너가 Service를 인스턴스화할 때
    //'method1'을 주어진 인자로 호출합니다.
    this.configureProvider<Service>(v => v.method1(this.config.value));
  }

  //모든 모듈에서 발견된 각 컨트롤러에 대해 실행됨
  processController(module: AppModule<any>, controller: ClassType) {
    //예를 들어 HttpModule은 각 컨트롤러에 대해 @http 데코레이터가 사용되었는지 확인하고,
    //그렇다면 모든 라우트 정보를 추출하여 라우터에 넣습니다.
  }

  //모든 모듈에서 발견된 각 provider에 대해 실행됨
  processProvider(module: AppModule<any>, token: Token, provider: ProviderWithScope) {
    //예를 들어 FrameworkModule은 deepkit/orm Database를 상속하는 제공된 토큰을 찾아
    //마이그레이션 CLI 명령과 Framework Debugger에서 사용할 수 있도록
    //자동으로 DatabaseRegistry에 등록합니다.
  }

  //모든 모듈이 처리된 후 실행됨.
  //process/processProvider에서 처리한 정보를 기반으로
  //module.configureProvider를 통해 provider를 설정할 수 있는 마지막 기회입니다.
  postProcess() {

  }
}
```

## 상태를 가진 모듈

각 모듈은 `new Module`로 명시적으로 인스턴스화되기 때문에 상태를 가질 수 있습니다. 이 상태는 의존성 주입 컨테이너에 주입되어 서비스에서 사용할 수 있습니다.

예시로 HttpModule의 사용 사례를 생각해봅시다. 애플리케이션 전체에 등록된 각 컨트롤러에 특정 @http 데코레이터가 있는지 확인하고, 있다면 컨트롤러를 레지스트리에 넣습니다. 이 레지스트리는 Router에 주입되고, Router가 인스턴스화될 때 해당 컨트롤러의 모든 라우트 정보를 추출하여 등록합니다.

```typescript
class Registry {
    protected controllers: { module: AppModule<any>, classType: ClassType }[] = [];
        
    register(module: AppModule<any>, controller: ClassType) {
        this.controllers.push({ module, classType: controller });
    }
        
    get(classType: ClassType) {
        const controller = this.controllers.find(v => v.classType === classType);
        if (!controller) throw new Error('Controller unknown');
        return controller;
    }
}
        
class Router {
    constructor(
        protected injectorContext: InjectorContext,
        protected registry: Registry
    ) {
    }
        
    getController(classType: ClassType) {
        //주어진 컨트롤러 classType에 대한 classType과 모듈을 찾습니다
        const controller = this.registry.get(classType);
        
        //여기서 컨트롤러가 인스턴스화됩니다. 이미 인스턴스화되어 있으면
        //이전 인스턴스를 반환합니다(해당 provider가 transient: true가 아닌 경우)
        return injector.get(controller.classType, controller.module);
    }
}
        
class HttpModule extends createModuleClass({
    providers: [Router],
    exports: [Router],
}) {
    protected registry = new Registry;
        
    process() {
        this.addProvider({ provide: Registry, useValue: this.registry });
    }
        
    processController(module: AppModule<any>, controller: ClassType) {
        //컨트롤러 소비자는 컨트롤러를 모듈의 providers에 넣어야 합니다
        if (!module.isProvided(controller)) module.addProvider(controller);
        this.registry.register(module, controller);
    }
}
        
class MyController {}
        
const app = new App({
    controllers: [MyController],
    imports: [new HttpModule()]
});
        
const myController = app.get(Router).getController(MyController);
```

## 루트용

`root` 프로퍼티를 사용하면 모듈의 의존성 주입 컨테이너를 루트 애플리케이션의 컨테이너로 이동시킬 수 있습니다. 이를 통해 모듈의 모든 서비스가 자동으로 루트 애플리케이션에서도 사용할 수 있게 됩니다. 이는 기본적으로 각 provider(컨트롤러, 이벤트 리스너, provider)를 루트 컨테이너로 이동시키는 것입니다. 의존성 충돌이 발생할 수 있으므로, 정말 전역만 포함하는 모듈에만 사용해야 합니다. 가능하면 각 provider를 수동으로 export하는 것을 권장합니다.

여러 모듈에서 사용할 수 있는 라이브러리를 구축하는 경우, `root` 사용을 피해야 합니다. 다른 라이브러리의 provider 토큰과 충돌할 수 있기 때문입니다. 예를 들어, 이 라이브러리 모듈이 서비스를 정의하는 `foo` 모듈을 import하고, 일부 서비스를 필요에 맞게 재구성했는데, 사용자의 애플리케이션도 동일한 `foo` 모듈을 import하는 경우, 사용자는 당신이 재구성한 서비스를 받게 됩니다. 더 단순한 사용 사례에서는 문제가 되지 않을 수도 있습니다.

```typescript
import { createModuleClass } from '@deepkit/app';

export class MyModule extends createModuleClass({}) {
  root = true;
}
```

서드파티 모듈의 `root` 프로퍼티를 `forRoot()`를 사용하여 변경할 수도 있습니다.

```typescript
new App({
    imports: [new ThirdPartyModule().forRoot()],
}).run();
```

## Injector Context

InjectorContext는 의존성 주입 컨테이너입니다. 이를 사용하여 자신의 모듈이나 다른 모듈에서 서비스의 요청/인스턴스화를 수행할 수 있습니다. 예를 들어 `processControllers`에서 컨트롤러를 저장해 두었다가, 이를 올바르게 인스턴스화하고자 할 때 필요합니다.