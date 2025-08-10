# 入门

由于 Deepkit HTTP 基于运行时类型，因此需要先正确安装运行时类型。参见 [运行时类型安装](../runtime-types/getting-started.md)。

如果这一步成功完成，则可以安装 `@deepkit/app`，或者使用已经在底层集成该库的 Deepkit 框架。

```sh
npm install @deepkit/http
```

请注意，用于控制器 API 的 `@deepkit/http` 基于 TypeScript 注解，一旦使用控制器 API，就必须通过 `experimentalDecorators` 启用此特性。
如果你不使用类，则无需启用该特性。

_文件：tsconfig.json_

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

库安装后，可直接使用其 API。

## 函数式 API

函数式 API 基于函数，可通过路由注册表进行注册；该注册表可以从应用的 DI 容器获取。

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

在使用模块时，函数式路由也可以由模块动态提供。

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

参见 [框架模块](../app/modules)，以了解更多关于应用模块的信息。

## 控制器 API

控制器 API 基于类，可通过 App API 的 `controllers` 选项进行注册。

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

在使用模块时，控制器也可以由模块提供。

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

若要动态提供控制器（例如取决于配置选项），可以使用 `process` 钩子。

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

参见 [框架模块](../app/modules)，以了解更多关于应用模块的信息。

## HTTP 服务器

如果使用 Deepkit 框架，则已内置 HTTP 服务器。不过，该 HTTP 库也可以在不使用 Deepkit 框架的情况下配合自有的 HTTP 服务器使用。

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

## HTTP 客户端

待办：fetch API、验证、und 类型转换。

## 路由名称

可以为路由指定唯一名称，以便在转发时引用。根据所用 API 的不同，命名方式有所差异。

```typescript
// 函数式 API
router.get({
    path: '/user/:id',
    name: 'userDetail'
}, (id: number) => {
    return {userId: id};
});

// 控制器 API
class UserController {
    @http.GET('/user/:id').name('userDetail')
    userDetail(id: number) {
        return {userId: id};
    }
}
```

对于所有具有名称的路由，可以通过 `Router.resolveUrl()` 获取其 URL。

```typescript
import { HttpRouter } from '@deepkit/http';
const router = app.get(HttpRouter);
router.resolveUrl('userDetail', {id: 2}); //=> '/user/2'
```

## 安全

## 会话