# 시작하기

Deepkit HTTP는 Runtime Types에 기반하므로, 먼저 Runtime Types가 올바르게 설치되어 있어야 합니다. [Runtime Types 설치](../runtime-types/getting-started.md)를 참고하세요.

이 작업이 성공적으로 완료되면, 라이브러리를 내부적으로 사용하는 Deepkit framework를 사용하거나 `@deepkit/app`을 설치할 수 있습니다.

```sh
npm install @deepkit/http
```

controller API용 `@deepkit/http`는 TypeScript annotations에 기반하므로 controller API를 사용할 때 `experimentalDecorators` 기능을 활성화해야 합니다.
클래스를 사용하지 않는다면 이 기능을 활성화할 필요가 없습니다.

_파일: tsconfig.json_

```json
{
  "compilerOptions": {
    "module": "CommonJS",
    "target": "es6",
    "moduleResolution": "node",
    "experimentalDecorators": true
  },
  "reflection": true
}
```

라이브러리를 설치하면 해당 API를 바로 사용할 수 있습니다.

## Functional API

Functional API는 함수에 기반하며, 앱의 DI 컨테이너를 통해 얻을 수 있는 router registry를 통해 등록할 수 있습니다.

```typescript
import { App } from '@deepkit/app';
import { FrameworkModule } from '@deepkit/framework';
import { HttpRouterRegistry } from '@deepkit/http';

const app = new App({
    imports: [new FrameworkModule]
});

const router = app.get(HttpRouterRegistry);

router.get('/', () => {
    return "Hello World!";
});

app.run();
```

모듈을 사용하면, 함수형 라우트도 모듈에서 동적으로 제공할 수 있습니다.

```typescript
import { App, createModuleClass } from '@deepkit/app';
import { FrameworkModule } from '@deepkit/framework';
import { HttpRouterRegistry } from '@deepkit/http';

class MyModule extends createModuleClass({}) {
  override process() {
    this.configureProvider<HttpRouterRegistry>(router => {
      router.get('/', () => {
        return "Hello World!";
      });
    });
  }
}

const app = new App({
  imports: [new FrameworkModule, new MyModule]
});
```

자세한 내용은 [프레임워크 모듈](../app/modules)을 참고하여 App 모듈에 대해 알아보세요.

## Controller API

Controller API는 클래스에 기반하며 App-API의 `controllers` 옵션을 통해 등록할 수 있습니다.

```typescript
import { App } from '@deepkit/app';
import { FrameworkModule } from '@deepkit/framework';
import { http } from '@deepkit/http';

class MyPage {
    @http.GET('/')
    helloWorld() {
        return "Hello World!";
    }
}

new App({
    controllers: [MyPage],
    imports: [new FrameworkModule]
}).run();
```

모듈을 사용하면 컨트롤러도 모듈에서 제공할 수 있습니다.

```typescript
import { App, createModuleClass } from '@deepkit/app';
import { FrameworkModule } from '@deepkit/framework';
import { http } from '@deepkit/http';

class MyPage {
  @http.GET('/')
  helloWorld() {
    return "Hello World!";
  }
}

class MyModule extends createModuleClass({}) {
  override process() {
    this.addController(MyPage);
  }
}

const app = new App({
  imports: [new FrameworkModule, new MyModule]
});
```

컨트롤러를 동적으로 제공하려면(예: 설정 옵션에 따라) `process` hook을 사용할 수 있습니다.

```typescript
class MyModuleConfiguration {
    debug: boolean = false;
}

class MyModule extends createModuleClass({
    config: MyModuleConfiguration
}) {
    override process() {
        if (this.config.debug) {
            class DebugController {
                @http.GET('/debug/')
                root() {
                    return 'Hello Debugger';
                }
            }
            this.addController(DebugController);
        }
    }
}
```

자세한 내용은 [프레임워크 모듈](../app/modules)을 참고하여 App 모듈에 대해 알아보세요.

## HTTP 서버

Deepkit Framework를 사용하면 HTTP 서버가 이미 내장되어 있습니다. 그러나 Deepkit Framework를 사용하지 않고도 HTTP 라이브러리를 자체 HTTP 서버와 함께 사용할 수 있습니다.

```typescript
import { Server } from 'http';
import { HttpRequest, HttpResponse } from '@deepkit/http';

const app = new App({
    controllers: [MyPage],
    imports: [new HttpModule]
});

const httpKernel = app.get(HttpKernel);

new Server(
    { IncomingMessage: HttpRequest, ServerResponse: HttpResponse, },
    ((req, res) => {
        httpKernel.handleRequest(req as HttpRequest, res as HttpResponse);
    })
).listen(8080, () => {
    console.log('listen at 8080');
});
```

## HTTP 클라이언트

todo: fetch API, validation, und cast.

## 라우트 이름

라우트에 고유한 이름을 지정하고 forwarding 시 이를 참조할 수 있습니다. 사용하는 API에 따라 이름을 정의하는 방식이 다릅니다.

```typescript
//functional API
router.get({
    path: '/user/:id',
    name: 'userDetail'
}, (id: number) => {
    return {userId: id};
});

//controller API
class UserController {
    @http.GET('/user/:id').name('userDetail')
    userDetail(id: number) {
        return {userId: id};
    }
}
```

이름이 있는 모든 라우트에 대해 `Router.resolveUrl()`로 URL을 요청할 수 있습니다.

```typescript
import { HttpRouter } from '@deepkit/http';
const router = app.get(HttpRouter);
router.resolveUrl('userDetail', {id: 2}); //=> '/user/2'
```

## 보안

## 세션