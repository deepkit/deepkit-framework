# Middleware

HTTP middlewares allow you to hook into the request/response cycle as an alternative to HTTP events. Its API allows you to use all middlewares from the Express/Connect framework.

A middleware can either be a class (which is instantiated by the dependency injection container) or a simple function.

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

## Global

By using httpMiddleware.for(MyMiddleware) a middleware is registered for all routes, globally.

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

## Per Controller

You can limit middlewares to one or multiple controllers in two ways. Either by using the `@http.controller` or `httpMiddleware.for(T).forControllers()`. `excludeControllers` allow you to exclude controllers.

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

## Per Route Name

`forRouteNames` along with its counterpart `excludeRouteNames` allow you to filter the execution of a middleware per route names.

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


## Per Action/Route

To execute a middleware only for a certain route, you can either use `@http.GET().middleware()` or
`httpMiddleware.for(T).forRoute()` where forRoute has multiple options to filter routes.

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

`forRoutes()` allows as first argument several way to filter for routes.

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

## Path Pattern

`path` supports wildcard *.

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

Filter all routes by a HTTP method.

```typescript
httpMiddleware.for(MyMiddleware).forRoutes({
    httpMethod: 'GET'
})
```

## Category

`category` along with its counterpart `excludeCategory` allow you to filter per route category.

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

## Group

`group` along with its counterpart `excludeGroup` allow you to filter per route group.

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

## Per Modules

You can limit the execution of a module for a whole module.

```typescript
httpMiddleware.for(MyMiddleware).forModule(ApiModule)
```


## Per Self Modules

To execute a middleware for all controllers/routes of a module where the middleware was registered use `forSelfModules()`.

```typescript
const ApiModule = new AppModule({}, {
    controllers: [MainController, UsersCommand],
    providers: [MyMiddleware],
    middlewares: [
        //for all controllers registered of the same module
        httpMiddleware.for(MyMiddleware).forSelfModules(),
    ],
});
```

## Timeout

All middleware needs to execute `next()` sooner or later. If a middleware does not execute `next()` withing a timeout, a warning is logged and the next middleware executed. To change the default of 4seconds to something else use timeout(milliseconds).

```typescript
const ApiModule = new AppModule({}, {
    controllers: [MainController, UsersCommand],
    providers: [MyMiddleware],
    middlewares: [
        //for all controllers registered of the same module
        httpMiddleware.for(MyMiddleware).timeout(15_000),
    ],
});
```

## Multiple Rules

To combine multiple filters, you can chain method calls.

```typescript
const ApiModule = new AppModule({}, {
    controllers: [MyController],
    providers: [MyMiddleware],
    middlewares: [
        httpMiddleware.for(MyMiddleware).forControllers(MyController).excludeRouteNames('secondRoute')
    ],
});
```

## Express Middleware

Almost all express middlewares are supported. Those who access certain request methods of express are not yet supported.

```typescript
import * as compression from 'compression';

const ApiModule = new AppModule({}, {
    middlewares: [
        httpMiddleware.for(compress()).forControllers(MyController)
    ],
});
```




