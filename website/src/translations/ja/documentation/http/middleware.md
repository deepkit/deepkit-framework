# ミドルウェア

HTTP ミドルウェアは、HTTP events の代替として request/response サイクルにフックすることを可能にします。その API により、Express/Connect フレームワークのあらゆるミドルウェアを利用できます。

ミドルウェアは、依存性注入コンテナによってインスタンス化される Class か、単純な Function のいずれかです。

```typescript
import { HttpMiddleware, httpMiddleware, HttpRequest, HttpResponse } from '@deepkit/http';

class MyMiddleware implements HttpMiddleware {
    async execute(request: HttpRequest, response: HttpResponse, next: (err?: any) => void) {
        response.setHeader('middleware', '1');
        next();
    }
}


function myMiddlewareFunction(request: HttpRequest, response: HttpResponse, next: (err?: any) => void) {
    response.setHeader('middleware', '1');
    next();
}

new App({
    providers: [MyMiddleware],
    middlewares: [
        httpMiddleware.for(MyMiddleware),
        httpMiddleware.for(myMiddlewareFunction),
    ],
    imports: [new FrameworkModule]
}).run();
```

## グローバル

httpMiddleware.for(MyMiddleware) を使用すると、ミドルウェアは全ての Route に対してグローバルに登録されます。

```typescript
import { httpMiddleware } from '@deepkit/http';

new App({
    providers: [MyMiddleware],
    middlewares: [
        httpMiddleware.for(MyMiddleware)
    ],
    imports: [new FrameworkModule]
}).run();
```

## Controller ごと

1 つまたは複数の Controller にミドルウェアを制限する方法は 2 つあります。`@http.controller` を使うか、`httpMiddleware.for(T).forControllers()` を使います。`excludeControllers` を使うと Controller を除外できます。

```typescript
@http.middleware(MyMiddleware)
class MyFirstController {

}
new App({
    providers: [MyMiddleware],
    controllers: [MainController, UsersCommand],
    middlewares: [
        httpMiddleware.for(MyMiddleware).forControllers(MyFirstController, MySecondController)
    ],
    imports: [new FrameworkModule]
}).run();
```

## Route 名ごと

`forRouteNames` と、その対になる `excludeRouteNames` により、Route 名ごとにミドルウェアの実行をフィルタできます。

```typescript
class MyFirstController {
    @http.GET('/hello').name('firstRoute')
    myAction() {
    }

    @http.GET('/second').name('secondRoute')
    myAction2() {
    }
}
new App({
    controllers: [MainController, UsersCommand],
    providers: [MyMiddleware],
    middlewares: [
        httpMiddleware.for(MyMiddleware).forRouteNames('firstRoute', 'secondRoute')
    ],
    imports: [new FrameworkModule]
}).run();
```

## Action/Route ごと

特定の Route のみにミドルウェアを適用するには、`@http.GET().middleware()` を使うか、
`httpMiddleware.for(T).forRoute()` を使います。forRoute には Route をフィルタするための複数のオプションがあります。

```typescript
class MyFirstController {
    @http.GET('/hello').middleware(MyMiddleware)
    myAction() {
    }
}
new App({
    controllers: [MainController, UsersCommand],
    providers: [MyMiddleware],
    middlewares: [
        httpMiddleware.for(MyMiddleware).forRoutes({
            path: 'api/*'
        })
    ],
    imports: [new FrameworkModule]
}).run();
```

`forRoutes()` は、最初の引数で Route をフィルタするための複数の方法を指定できます。

```typescript
{
    path?: string;
    pathRegExp?: RegExp;
    httpMethod?: 'GET' | 'HEAD' | 'POST' | 'PATCH' | 'PUT' | 'DELETE' | 'OPTIONS' | 'TRACE';
    category?: string;
    excludeCategory?: string;
    group?: string;
    excludeGroup?: string;
}
```

## パスパターン

`path` はワイルドカード * をサポートします。

```typescript
httpMiddleware.for(MyMiddleware).forRoutes({
    path: 'api/*'
})
```

## RegExp

```typescript
httpMiddleware.for(MyMiddleware).forRoutes({
    pathRegExp: /'api/.*'/
})
```

## HTTP Method

HTTP Method で全ての Route をフィルタします。

```typescript
httpMiddleware.for(MyMiddleware).forRoutes({
    httpMethod: 'GET'
})
```

## カテゴリ

`category` と、その対になる `excludeCategory` により、Route のカテゴリごとにフィルタできます。

```typescript
@http.category('myCategory')
class MyFirstController {

}

class MySecondController {
    @http.GET().category('myCategory')
    myAction() {
    }
}
httpMiddleware.for(MyMiddleware).forRoutes({
    category: 'myCategory'
})
```

## グループ

`group` と、その対になる `excludeGroup` により、Route のグループごとにフィルタできます。

```typescript
@http.group('myGroup')
class MyFirstController {

}

class MySecondController {
    @http.GET().group('myGroup')
    myAction() {
    }
}
httpMiddleware.for(MyMiddleware).forRoutes({
    group: 'myGroup'
})
```

## Module ごと

ミドルウェアの実行を特定の Module 全体に限定できます。

```typescript
httpMiddleware.for(MyMiddleware).forModule(ApiModule)
```

## 自身の Module ごと

ミドルウェアが登録された Module 内のすべての Controller/Route に対してミドルウェアを実行するには、`forSelfModules()` を使用します。

```typescript
const ApiModule = new AppModule({}, {
    controllers: [MainController, UsersCommand],
    providers: [MyMiddleware],
    middlewares: [
        //同じ Module に登録されたすべての Controller に対して
        httpMiddleware.for(MyMiddleware).forSelfModules(),
    ],
});
```

## タイムアウト

すべてのミドルウェアは遅かれ早かれ `next()` を実行する必要があります。タイムアウト内にミドルウェアが `next()` を実行しない場合、警告がログに記録され、次のミドルウェアが実行されます。デフォルトの 4 秒を変更するには、`timeout(milliseconds)` を使用します。

```typescript
const ApiModule = new AppModule({}, {
    controllers: [MainController, UsersCommand],
    providers: [MyMiddleware],
    middlewares: [
        //同じ Module に登録されたすべての Controller に対して
        httpMiddleware.for(MyMiddleware).timeout(15_000),
    ],
});
```

## 複数のルール

複数のフィルタを組み合わせるには、Method 呼び出しをチェーンできます。

```typescript
const ApiModule = new AppModule({}, {
    controllers: [MyController],
    providers: [MyMiddleware],
    middlewares: [
        httpMiddleware.for(MyMiddleware).forControllers(MyController).excludeRouteNames('secondRoute')
    ],
});
```

## Express ミドルウェア

ほとんどの Express ミドルウェアはサポートされています。Express の特定の request メソッドにアクセスするものは、まだサポートされていません。

```typescript
import * as compression from 'compression';

const ApiModule = new AppModule({}, {
    middlewares: [
        httpMiddleware.for(compress()).forControllers(MyController)
    ],
});
```