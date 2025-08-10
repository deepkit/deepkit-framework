# Injektion

Es heißt Dependency Injection, da eine Abhängigkeit injiziert wird. Die Injektion erfolgt entweder durch den Benutzer (manuell) oder durch den DI-Container (automatisch).

## Konstruktorinjektion

In den meisten Fällen wird die Konstruktorinjektion verwendet. Alle Abhängigkeiten werden als Konstruktor-Argumente angegeben und automatisch vom DI-Container injiziert.

```typescript
class MyService {
    constructor(protected database: Database) {
    }
}
```

Optionale Abhängigkeiten sollten entsprechend markiert werden, andernfalls könnte ein Error ausgelöst werden, wenn kein Provider gefunden wird.

```typescript
class MyService {
    constructor(protected database?: Database) {
    }
}
```

## Eigenschaftsinjektion

Eine Alternative zur Konstruktorinjektion ist die Eigenschaftsinjektion. Diese wird üblicherweise verwendet, wenn die Abhängigkeit optional ist oder der Konstruktor sonst zu voll wäre. Die Properties werden automatisch zugewiesen, sobald die Instanz erstellt wurde (und damit der Konstruktor ausgeführt wurde).

```typescript
import { Inject } from '@deepkit/core';

class MyService {
    //erforderlich
    protected database!: Inject<Database>;

    //oder optional
    protected database?: Inject<Database>;
}
```

## Parameterinjektion

An verschiedenen Stellen kannst du eine Callback Function definieren, zum Beispiel für HTTP Routes oder CLI Commands. In diesem Fall kannst du Abhängigkeiten als Parameter definieren.
Sie werden automatisch vom DI-Container injiziert.

```typescript
import { Database } from './db';

app.get('/', (database: Database) => {
    //...
});
```

## Injector-Kontext

Falls du Abhängigkeiten dynamisch auflösen möchtest, kannst du `InjectorContext` injizieren und ihn verwenden, um Abhängigkeiten zu beziehen.

```typescript
import { InjectorContext } from '@deepkit/injector';

class MyService {
    constructor(protected context: InjectorContext) {
    }

    getDatabase(): Database {
        return this.context.get(Database);
    }
}
```

Dies ist besonders nützlich bei der Arbeit mit [Dependency Injection Scopes](./scopes.md).