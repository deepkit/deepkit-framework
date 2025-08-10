# はじめに

Deepkit HTTP は Runtime Types に基づいているため、事前に Runtime Types が正しくインストールされている必要があります。詳細は [Runtime Type のインストール](../runtime-types/getting-started.md) を参照してください。

これが完了していれば、`@deepkit/app` をインストールするか、すでにこのライブラリを内部で使用している Deepkit フレームワークを利用できます。

```sh
npm install @deepkit/http
```

controller API 用の `@deepkit/http` は TypeScript のアノテーションに基づいているため、controller API を使用する場合は `experimentalDecorators` を有効にする必要があります。
Class を使用しない場合は、この機能を有効にする必要はありません。

_ファイル: tsconfig.json_

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

ライブラリをインストールすると、その API を直接使用できます。

## 関数型 API

関数型 API は Function ベースで、アプリの DI コンテナから取得できるルーター・レジストリ経由で登録できます。

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

Module を使用する場合、関数型ルートは Module から動的に提供することもできます。

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

App Module の詳細は、[Framework モジュール](../app/modules) を参照してください。

## コントローラ API

Controller API は Class ベースで、App-API の `controllers` オプションで登録できます。

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

Module を使用する場合、Controller も Module から提供できます。

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

設定オプションに応じてなど、Controller を動的に提供するには、`process` フックを使用できます。

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

App Module の詳細は、[Framework モジュール](../app/modules) を参照してください。

## HTTP サーバー

Deepkit Framework を使用する場合、HTTP サーバーはすでに内蔵されています。Deepkit フレームワークを使用せず、HTTP ライブラリを独自の HTTP サーバーと併用することもできます。

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

## HTTP クライアント

TODO: fetch API、バリデーション、und キャスト。

## ルート名

ルートには転送時に参照できる一意の名前を付けられます。API によって、名前の定義方法は異なります。

```typescript
// 関数型 API
router.get({
    path: '/user/:id',
    name: 'userDetail'
}, (id: number) => {
    return {userId: id};
});

// コントローラ API
class UserController {
    @http.GET('/user/:id').name('userDetail')
    userDetail(id: number) {
        return {userId: id};
    }
}
```

名前付きのすべてのルートから、`Router.resolveUrl()` で URL を取得できます。

```typescript
import { HttpRouter } from '@deepkit/http';
const router = app.get(HttpRouter);
router.resolveUrl('userDetail', {id: 2}); //=> '/user/2'
```

## セキュリティ

## セッション