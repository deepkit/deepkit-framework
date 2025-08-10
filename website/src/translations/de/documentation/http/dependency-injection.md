# Dependency Injection

Die Router-Funktionen sowie die Controller-Klassen und Controller-Methoden können beliebige Dependencies definieren, die vom Dependency Injection-Container aufgelöst werden. So ist es z. B. möglich, bequem auf eine Datenbankabstraktion oder einen Logger zuzugreifen.

Wenn z. B. eine Datenbank als Provider bereitgestellt wurde, kann sie injiziert werden:

```typescript
class Database {
    //...
}

const app = new App({
    providers: [
        Database,
    ],
});
```

_Funktionale API:_

```typescript
router.get('/user/:id', async (id: number, database: Database) => {
    return await database.query(User).filter({id}).findOne();
});
```

_Controller-API:_

```typescript
class UserController {
    constructor(private database: Database) {}

    @http.GET('/user/:id')
    async userDetail(id: number) {
        return await this.database.query(User).filter({id}).findOne();
    }
}

//alternativ direkt in der Methode
class UserController {
    @http.GET('/user/:id')
    async userDetail(id: number, database: Database) {
        return await database.query(User).filter({id}).findOne();
    }
}
```

Siehe [Dependency Injection](dependency-injection), um mehr zu erfahren.

## Scope

Alle HTTP-Controller und funktionalen Routen werden innerhalb des `http` Dependency Injection-Scope verwaltet. HTTP-Controller werden entsprechend für jede HTTP-Anfrage instanziiert. Das bedeutet auch, dass beide auf Provider zugreifen können, die für den `http` Scope registriert sind. Zusätzlich sind `HttpRequest` und `HttpResponse` aus `@deepkit/http` als Dependencies nutzbar. Wenn das deepkit framework verwendet wird, ist auch `SessionHandler` aus `@deepkit/framework` verfügbar.

```typescript
import { HttpResponse } from '@deepkit/http';

router.get('/user/:id', (id: number, request: HttpRequest) => {
});

router.get('/', (response: HttpResponse) => {
    response.end('Hello');
});
```

Es kann sinnvoll sein, Provider im `http` Scope zu platzieren, z. B. um Services für jede HTTP-Anfrage zu instanziieren. Sobald die HTTP-Anfrage verarbeitet wurde, wird der DI-Container im `http` Scope gelöscht, wodurch alle seine Provider-Instanzen vom Garbage Collector (GC) bereinigt werden.

Siehe [Dependency Injection Scopes](dependency-injection.md#di-scopes), um zu erfahren, wie Provider im `http` Scope platziert werden.