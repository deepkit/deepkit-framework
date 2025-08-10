# Erste Schritte

Da Deepkit HTTP auf Runtime Types basiert, ist es notwendig, dass Runtime Types bereits korrekt installiert sind. Siehe [Installation von Runtime Types](../runtime-types/getting-started.md).

Wenn dies erfolgreich erfolgt ist, kann `@deepkit/app` installiert werden oder das Deepkit Framework, das die Library bereits unter der Haube verwendet.

```sh
npm install @deepkit/http
```

Beachte, dass `@deepkit/http` für die Controller-API auf TypeScript-Annotations basiert und dieses Feature beim Einsatz der Controller-API mit `experimentalDecorators` aktiviert werden muss.
Wenn du keine Klassen verwendest, musst du dieses Feature nicht aktivieren.

_Datei: tsconfig.json_

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

Sobald die Library installiert ist, kann ihre API direkt verwendet werden.

## Funktionale API

Die funktionale API basiert auf Funktionen und kann über das Router-Registry registriert werden, die über den DI-Container der App bezogen werden kann.

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

Sobald Module verwendet werden, können funktionale Routen auch dynamisch von Modulen bereitgestellt werden.

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

Siehe [Framework-Module](../app/modules), um mehr über App-Module zu erfahren.

## Controller-API

Die Controller-API basiert auf Klassen und kann über die App-API unter der Option `controllers` registriert werden.

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

Sobald Module verwendet werden, können Controller auch durch Module bereitgestellt werden.

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

Um Controller dynamisch bereitzustellen (z. B. abhängig von der Konfigurationsoption), kann der `process`-Hook verwendet werden.

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

Siehe [Framework-Module](../app/modules), um mehr über App-Module zu erfahren.

## HTTP-Server

Wenn das Deepkit Framework verwendet wird, ist ein HTTP-Server bereits integriert. Die HTTP-Library kann jedoch auch mit einem eigenen HTTP-Server ohne das Deepkit Framework verwendet werden.

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

## HTTP-Client

todo: fetch API, validation, und cast.

## Routen-Namen

Routen können einen eindeutigen Namen erhalten, auf den bei der Weiterleitung verwiesen werden kann. Je nach API unterscheidet sich die Art, wie ein Name definiert wird.

```typescript
//Funktionale API
router.get({
    path: '/user/:id',
    name: 'userDetail'
}, (id: number) => {
    return {userId: id};
});

//Controller-API
class UserController {
    @http.GET('/user/:id').name('userDetail')
    userDetail(id: number) {
        return {userId: id};
    }
}
```

Für alle Routen mit einem Namen kann die URL über `Router.resolveUrl()` abgefragt werden.

```typescript
import { HttpRouter } from '@deepkit/http';
const router = app.get(HttpRouter);
router.resolveUrl('userDetail', {id: 2}); //=> '/user/2'
```

## Sicherheit

## Sitzungen