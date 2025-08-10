# 미들웨어

HTTP 미들웨어는 HTTP events의 대안으로 요청/응답 사이클에 hook할 수 있게 해줍니다. 해당 API는 Express/Connect 프레임워크의 모든 미들웨어를 사용할 수 있도록 합니다.

미들웨어는 의존성 주입 컨테이너에 의해 인스턴스화되는 Class이거나, 간단한 Function일 수 있습니다.

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

## 전역

`httpMiddleware.for(MyMiddleware)`를 사용하면 미들웨어가 모든 라우트에 전역으로 등록됩니다.

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

## 컨트롤러 단위

미들웨어를 하나 또는 여러 컨트롤러에만 제한하는 두 가지 방법이 있습니다. `@http.controller`를 사용하거나 `httpMiddleware.for(T).forControllers()`를 사용할 수 있습니다. `excludeControllers`를 사용하면 특정 컨트롤러를 제외할 수 있습니다.

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

## 라우트 이름 단위

`forRouteNames`와 이에 대응하는 `excludeRouteNames`를 사용하면 라우트 이름별로 미들웨어 실행을 필터링할 수 있습니다.

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

## 액션/라우트 단위

특정 라우트에만 미들웨어를 실행하려면 `@http.GET().middleware()` 또는
`httpMiddleware.for(T).forRoute()`를 사용할 수 있으며, forRoute에는 라우트를 필터링하기 위한 여러 옵션이 있습니다.

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

`forRoutes()`의 첫 번째 인수로 라우트를 필터링하는 여러 방법을 지정할 수 있습니다.

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

## 경로 패턴

`path`는 와일드카드 *를 지원합니다.

```typescript
httpMiddleware.for(MyMiddleware).forRoutes({
    path: 'api/*'
})
```

## 정규식

```typescript
httpMiddleware.for(MyMiddleware).forRoutes({
    pathRegExp: /'api/.*'/
})
```

## HTTP 메서드

모든 라우트를 특정 HTTP 메서드로 필터링합니다.

```typescript
httpMiddleware.for(MyMiddleware).forRoutes({
    httpMethod: 'GET'
})
```

## 카테고리

`category`와 이에 대응하는 `excludeCategory`를 사용하면 라우트 카테고리별로 필터링할 수 있습니다.

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

## 그룹

`group`과 이에 대응하는 `excludeGroup`을 사용하면 라우트 그룹별로 필터링할 수 있습니다.

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

## 모듈 단위

모듈 전체에 대해 미들웨어 적용을 제한할 수 있습니다.

```typescript
httpMiddleware.for(MyMiddleware).forModule(ApiModule)
```

## 자체 모듈 단위

미들웨어가 등록된 모듈의 모든 컨트롤러/라우트에 미들웨어를 적용하려면 `forSelfModules()`를 사용하세요.

```typescript
const ApiModule = new AppModule({}, {
    controllers: [MainController, UsersCommand],
    providers: [MyMiddleware],
    middlewares: [
        //같은 모듈에 등록된 모든 컨트롤러에 대해
        httpMiddleware.for(MyMiddleware).forSelfModules(),
    ],
});
```

## 타임아웃

모든 미들웨어는 결국 `next()`를 호출해야 합니다. 미들웨어가 타임아웃 내에 `next()`를 호출하지 않으면 경고가 로깅되고 다음 미들웨어가 실행됩니다. 기본값인 4초를 다른 값으로 변경하려면 timeout(milliseconds)를 사용하세요.

```typescript
const ApiModule = new AppModule({}, {
    controllers: [MainController, UsersCommand],
    providers: [MyMiddleware],
    middlewares: [
        //같은 모듈에 등록된 모든 컨트롤러에 대해
        httpMiddleware.for(MyMiddleware).timeout(15_000),
    ],
});
```

## 다중 규칙

여러 필터를 결합하려면 메서드 호출을 체이닝하면 됩니다.

```typescript
const ApiModule = new AppModule({}, {
    controllers: [MyController],
    providers: [MyMiddleware],
    middlewares: [
        httpMiddleware.for(MyMiddleware).forControllers(MyController).excludeRouteNames('secondRoute')
    ],
});
```

## Express 미들웨어

거의 모든 express 미들웨어가 지원됩니다. 다만 express의 특정 request 메서드에 접근하는 미들웨어는 아직 지원되지 않습니다.

```typescript
import * as compression from 'compression';

const ApiModule = new AppModule({}, {
    middlewares: [
        httpMiddleware.for(compress()).forControllers(MyController)
    ],
});
```