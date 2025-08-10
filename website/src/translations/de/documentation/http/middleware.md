# Middleware

HTTP-Middlewares ermöglichen es, sich als Alternative zu HTTP-Events in den Request/Response-Zyklus einzuklinken. Die API erlaubt die Nutzung aller Middlewares aus dem Express/Connect-Framework.

Eine Middleware kann entweder eine Class (die vom Dependency-Injection-Container instanziiert wird) oder eine einfache Function sein.

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

Mit httpMiddleware.for(MyMiddleware) wird eine Middleware global für alle Routes registriert.

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

## Pro Controller

Sie können Middlewares auf einen oder mehrere Controller auf zwei Arten beschränken: Entweder mit `@http.controller` oder `httpMiddleware.for(T).forControllers()`. `excludeControllers` erlaubt es, Controller auszuschließen.

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

## Pro Route-Name

`forRouteNames` zusammen mit dem Gegenstück `excludeRouteNames` ermöglicht es, die Ausführung einer Middleware pro Route-Namen zu filtern.

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

## Pro Action/Route

Um eine Middleware nur für eine bestimmte Route auszuführen, können Sie entweder `@http.GET().middleware()` oder
`httpMiddleware.for(T).forRoute()` verwenden, wobei forRoute mehrere Optionen bietet, um Routes zu filtern.

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

`forRoutes()` erlaubt als erstes Argument mehrere Möglichkeiten, nach Routes zu filtern.

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

## Pfad-Muster

`path` unterstützt Wildcard *.

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

## HTTP-Methode

Alle Routes nach einer HTTP-Methode filtern.

```typescript
httpMiddleware.for(MyMiddleware).forRoutes({
    httpMethod: 'GET'
})
```

## Kategorie

`category` zusammen mit dem Gegenstück `excludeCategory` ermöglicht das Filtern nach Route-Kategorie.

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

## Gruppe

`group` zusammen mit dem Gegenstück `excludeGroup` ermöglicht das Filtern nach Route-Gruppe.

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

## Pro Module

Sie können die Ausführung einer Middleware auf ein ganzes Modul begrenzen.

```typescript
httpMiddleware.for(MyMiddleware).forModule(ApiModule)
```

## Für eigene Module

Um eine Middleware für alle Controller/Routes eines Moduls auszuführen, in dem die Middleware registriert wurde, verwenden Sie `forSelfModules()`.

```typescript
const ApiModule = new AppModule({}, {
    controllers: [MainController, UsersCommand],
    providers: [MyMiddleware],
    middlewares: [
        //für alle im selben Modul registrierten Controller
        httpMiddleware.for(MyMiddleware).forSelfModules(),
    ],
});
```

## Timeout

Alle Middlewares müssen früher oder später `next()` ausführen. Wenn eine Middleware `next()` innerhalb eines Timeouts nicht ausführt, wird eine Warnung geloggt und die nächste Middleware ausgeführt. Um den Standard von 4 Sekunden zu ändern, verwenden Sie `timeout(milliseconds)`.

```typescript
const ApiModule = new AppModule({}, {
    controllers: [MainController, UsersCommand],
    providers: [MyMiddleware],
    middlewares: [
        //für alle im selben Modul registrierten Controller
        httpMiddleware.for(MyMiddleware).timeout(15_000),
    ],
});
```

## Mehrere Regeln

Um mehrere Filter zu kombinieren, können Sie Methodenaufrufe verketten.

```typescript
const ApiModule = new AppModule({}, {
    controllers: [MyController],
    providers: [MyMiddleware],
    middlewares: [
        httpMiddleware.for(MyMiddleware).forControllers(MyController).excludeRouteNames('secondRoute')
    ],
});
```

## Express-Middleware

Fast alle Express-Middlewares werden unterstützt. Solche, die auf bestimmte Request-Methoden von Express zugreifen, werden noch nicht unterstützt.

```typescript
import * as compression from 'compression';

const ApiModule = new AppModule({}, {
    middlewares: [
        httpMiddleware.for(compress()).forControllers(MyController)
    ],
});
```