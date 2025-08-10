# 中间件

HTTP 中间件允许你在请求/响应周期中挂钩，作为 HTTP 事件的替代方案。其 API 允许你使用来自 Express/Connect 框架的所有中间件。

中间件可以是一个类（由依赖注入容器实例化），也可以是一个简单函数。

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

## 全局

通过使用 httpMiddleware.for(MyMiddleware)，可以将中间件全局注册到所有路由。

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

## 按控制器

可以通过两种方式将中间件限定到一个或多个控制器：使用 `@http.controller`，或使用 `httpMiddleware.for(T).forControllers()`。`excludeControllers` 允许你排除某些控制器。

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

## 按路由名称

`forRouteNames` 及其对应的 `excludeRouteNames` 允许你按路由名称筛选中间件的执行。

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

## 按操作/路由

若只在某个路由上执行中间件，可以使用 `@http.GET().middleware()`，或使用 `httpMiddleware.for(T).forRoute()`，其中 forRoute 提供多种选项来筛选路由。

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

`forRoutes()` 的第一个参数支持多种方式来筛选路由。

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

## 路径模式

`path` 支持通配符 *。

```typescript
httpMiddleware.for(MyMiddleware).forRoutes({
    path: 'api/*'
})
```

## 正则表达式

```typescript
httpMiddleware.for(MyMiddleware).forRoutes({
    pathRegExp: /'api/.*'/
})
```

## HTTP 方法

按某个 HTTP 方法筛选所有路由。

```typescript
httpMiddleware.for(MyMiddleware).forRoutes({
    httpMethod: 'GET'
})
```

## 分类

`category` 及其对应的 `excludeCategory` 允许你按路由分类进行筛选。

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

## 分组

`group` 及其对应的 `excludeGroup` 允许你按路由分组进行筛选。

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

## 按模块

可以将中间件的执行限定为整个模块。

```typescript
httpMiddleware.for(MyMiddleware).forModule(ApiModule)
```

## 按自身模块

若要让中间件只在其注册所在的模块中的所有控制器/路由上执行，请使用 `forSelfModules()`。

```typescript
const ApiModule = new AppModule({}, {
    controllers: [MainController, UsersCommand],
    providers: [MyMiddleware],
    middlewares: [
        //对同一模块中注册的所有控制器
        httpMiddleware.for(MyMiddleware).forSelfModules(),
    ],
});
```

## 超时

所有中间件最终都需要调用 `next()`。如果某个中间件在超时时间内没有调用 `next()`，则会记录一条警告并继续执行下一个中间件。要将默认的 4 秒更改为其他值，请使用 timeout(milliseconds)。

```typescript
const ApiModule = new AppModule({}, {
    controllers: [MainController, UsersCommand],
    providers: [MyMiddleware],
    middlewares: [
        //对同一模块中注册的所有控制器
        httpMiddleware.for(MyMiddleware).timeout(15_000),
    ],
});
```

## 多重规则

要组合多个筛选条件，可以链式调用方法。

```typescript
const ApiModule = new AppModule({}, {
    controllers: [MyController],
    providers: [MyMiddleware],
    middlewares: [
        httpMiddleware.for(MyMiddleware).forControllers(MyController).excludeRouteNames('secondRoute')
    ],
});
```

## Express 中间件

几乎所有 Express 中间件都受支持。那些依赖于 Express 特定请求方法的中间件目前尚不支持。

```typescript
import * as compression from 'compression';

const ApiModule = new AppModule({}, {
    middlewares: [
        httpMiddleware.for(compress()).forControllers(MyController)
    ],
});
```