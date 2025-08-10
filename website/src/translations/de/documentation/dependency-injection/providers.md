# Provider

Es gibt mehrere Möglichkeiten, Abhängigkeiten im Dependency Injection Container bereitzustellen. Die einfachste Variante ist einfach die Angabe einer Class. Dies ist auch als kurzer ClassProvider bekannt.

```typescript
new App({
    providers: [UserRepository]
});
```

Dies stellt einen speziellen Provider dar, da nur die Class angegeben wird. Alle anderen Provider müssen als Objektliteral angegeben werden.

Standardmäßig sind alle Provider als Singletons markiert, sodass zu jedem Zeitpunkt nur eine Instanz existiert. Um bei jeder Auflösung eines Providers eine neue Instanz zu erstellen, kann die Option `transient` verwendet werden. Dadurch werden Classes jedes Mal neu instanziert oder Factories jedes Mal ausgeführt.

```typescript
new App({
    providers: [{ provide: UserRepository, transient: true }]
});
```

## ClassProvider

Neben dem kurzen ClassProvider gibt es auch den regulären ClassProvider, der als Objektliteral statt als Class angegeben wird.

```typescript
new App({
    providers: [{ provide: UserRepository, useClass: UserRepository }]
});
```

Dies entspricht diesen beiden:

```typescript
new App({
    providers: [{ provide: UserRepository }]
});

new App({
    providers: [UserRepository]
});
```

Er kann verwendet werden, um einen Provider durch eine andere Class auszutauschen.

```typescript
new App({
    providers: [{ provide: UserRepository, useClass: OtherUserRepository }]
});
```

In diesem Beispiel wird die Class `OtherUserRepository` nun ebenfalls im DI-Container verwaltet und all ihre Abhängigkeiten werden automatisch aufgelöst.

## ValueProvider

Statische Werte können mit diesem Provider bereitgestellt werden.

```typescript
new App({
    providers: [{ provide: OtherUserRepository, useValue: new OtherUserRepository() }]
});
```

Da nicht nur Class-Instanzen als Abhängigkeiten bereitgestellt werden können, kann jeder Wert als `useValue` angegeben werden. Ein symbol oder ein Primitive (string, number, boolean) könnte ebenfalls als Provider-Token verwendet werden.

```typescript
new App({
    providers: [{ provide: 'domain', useValue: 'localhost' }]
});
```

Primitive Provider-Token müssen mit dem Inject Type als Abhängigkeit deklariert werden.

```typescript
import { Inject } from '@deepkit/core';

class EmailService {
    constructor(public domain: Inject<string, 'domain'>) {}
}
```

Die Kombination aus einem Inject-Alias und primitiven Provider-Token kann auch verwendet werden, um Abhängigkeiten aus Packages bereitzustellen, die keine Runtime-Type-Informationen enthalten.

```typescript
import { Inject } from '@deepkit/core';
import { Stripe } from 'stripe';

export type StripeService = Inject<Stripe, '_stripe'>;

new App({
    providers: [{ provide: '_stripe', useValue: new Stripe }]
});
```

Und dann auf der Nutzerseite wie folgt deklariert:

```typescript
class PaymentService {
    constructor(public stripe: StripeService) {}
}
```

## ExistingProvider

Eine Weiterleitung auf einen bereits definierten Provider kann definiert werden.

```typescript
new App({
    providers: [
        {provide: OtherUserRepository, useValue: new OtherUserRepository()},
        {provide: UserRepository, useExisting: OtherUserRepository}
    ]
});
```

## FactoryProvider

Eine Function kann verwendet werden, um einen Wert für den Provider bereitzustellen. Diese Function kann auch Parameters enthalten, die wiederum vom DI-Container bereitgestellt werden. So werden andere Abhängigkeiten oder Konfigurationsoptionen zugänglich.

```typescript
new App({
    providers: [
        {provide: OtherUserRepository, useFactory: () => {
            return new OtherUserRepository()
        }},
    ]
});

new App({
    providers: [
        {provide: OtherUserRepository, useFactory: (domain: RootConfiguration['domain']) => {
            return new OtherUserRepository(domain);
        }},
    ]
});

new App({
    providers: [
        Database,
        {provide: OtherUserRepository, useFactory: (database: Database) => {
            return new OtherUserRepository(database);
        }},
    ]
});
```

## InterfaceProvider

Neben Classes und Primitives können auch Abstraktionen (Interfaces) bereitgestellt werden. Dies geschieht über die Function `provide` und ist besonders nützlich, wenn der bereitzustellende Wert keine Type-Informationen enthält.

```typescript
import { provide } from '@deepkit/injector';

interface Connection {
    write(data: Uint16Array): void;
}

class Server {
   constructor (public connection: Connection) {}
}

class MyConnection {
    write(data: Uint16Array): void {}
}

new App({
    providers: [
        Server,
        provide<Connection>(MyConnection)
    ]
});
```

Wenn mehrere Provider das Connection Interface implementiert haben, wird der letzte Provider verwendet.

Als Argument für provide() sind alle anderen Provider möglich.

```typescript
const myConnection = {write: (data: any) => undefined};

new App({
    providers: [
        provide<Connection>({ useValue: myConnection })
    ]
});

new App({
    providers: [
        provide<Connection>({ useFactory: () => myConnection })
    ]
});
```

## Asynchrone Provider

Das Design von `@deepkit/injector` schließt die Verwendung asynchroner Provider mit einem asynchronen Dependency Injection Container aus. Dies liegt daran, dass auch das Anfordern von Providern asynchron sein müsste, wodurch die gesamte Anwendung auf höchster Ebene asynchron arbeiten müsste.

Um etwas asynchron zu initialisieren, sollte diese Initialisierung in den Application-Server-Bootstrap verlegt werden, da dort die Events asynchron sein können. Alternativ kann eine Initialisierung manuell ausgelöst werden.

## Provider konfigurieren

Konfigurations-Callbacks erlauben es, das Ergebnis eines Providers zu manipulieren. Das ist z. B. nützlich, um eine andere Dependency Injection-Variante zu nutzen, die Method Injection.

Sie können nur mit der Module API oder der App API verwendet werden und werden oberhalb des Moduls registriert.

```typescript
class UserRepository  {
    private db?: Database;
    setDatabase(db: Database) {
       this.db = db;
    }
}

const rootModule = new InjectorModule([UserRepository])
     .addImport(lowLevelModule);

rootModule.configureProvider<UserRepository>(v => {
  v.setDatabase(db);
});
```

`configureProvider` erhält im Callback als ersten Parameter `v` die UserRepository-Instanz, auf der ihre Methods aufgerufen werden können.

Neben Method-Calls können auch Properties gesetzt werden.

```typescript
class UserRepository  {
    db?: Database;
}

const rootModule = new InjectorModule([UserRepository])
     .addImport(lowLevelModule);

rootModule.configureProvider<UserRepository>(v => {
  v.db = new Database();
});
```

Alle Callbacks werden in eine Queue gestellt und in der Reihenfolge ihrer Definition ausgeführt.

Die Aufrufe in der Queue werden dann auf das tatsächliche Ergebnis des Providers ausgeführt, sobald der Provider erstellt wird. Das heißt: Bei einem ClassProvider werden sie auf die Class-Instanz angewendet, sobald die Instanz erstellt wurde; bei einem FactoryProvider auf das Ergebnis der Factory; und bei einem ValueProvider auf den Wert.

Um nicht nur statische Werte, sondern auch andere Provider zu referenzieren, können beliebige Abhängigkeiten in den Callback injiziert werden, indem sie einfach als Arguments definiert werden. Stellen Sie sicher, dass diese Abhängigkeiten im Provider-Scope bekannt sind.

```typescript
class Database {}

class UserRepository  {
    db?: Database;
}

const rootModule = new InjectorModule([UserRepository, Database])
rootModule.configureProvider<UserRepository>((v, db: Database) => {
  v.db = db;
});
```

## Nominale Typen

Beachten Sie, dass der an `configureProvider` übergebene Typ, wie im letzten Beispiel `UserRepository`, nicht mittels struktureller Typprüfung, sondern anhand nominaler Typen aufgelöst wird. Das bedeutet zum Beispiel, dass zwei Classes/Interfaces mit gleicher Struktur, aber unterschiedlicher Identität nicht kompatibel sind. Gleiches gilt für `get<T>`-Aufrufe oder wenn eine Abhängigkeit aufgelöst wird.

Dies unterscheidet sich von der Art, wie die TypeScript-Typprüfung funktioniert, die auf struktureller Typprüfung basiert. Diese Designentscheidung wurde getroffen, um versehentliche Fehlkonfigurationen zu vermeiden (z. B. das Anfordern einer leeren Class, die strukturell mit jeder Class kompatibel ist) und um den Code robuster zu machen.

Im folgenden Beispiel sind die Classes `User1` und `User2` strukturell kompatibel, aber nicht nominal. Das bedeutet, dass das Anfordern von `User1` nicht `User2` auflöst und umgekehrt.

```typescript

class User1 {
    name: string = '';
}

class User2 {
    name: string = '';
}

new App({
    providers: [User1, User2]
});
```

Das Erweitern von Classes und das Implementieren von Interfaces stellt eine nominale Beziehung her.

```typescript
class UserBase {
    name: string = '';
}

class User extends UserBase {
}

const app = new App({
    providers: [User2]
});

app.get(UserBase); //gibt User zurück
```

```typescript
interface UserInterface {
    name: string;
}

class User implements UserInterface {
    name: string = '';
}

const app = new App({
    providers: [User]
});

app.get<UserInterface>(); //gibt User zurück
```