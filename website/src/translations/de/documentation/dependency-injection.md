# Dependency Injection

Dependency Injection (DI) ist ein Design Pattern, bei dem Klassen und Funktionen ihre Dependencies _empfangen_. Es folgt dem Prinzip der Inversion of Control (IoC) und hilft, komplexen Code besser zu trennen, um Testbarkeit, Modularität und Übersichtlichkeit deutlich zu verbessern. Obwohl es andere Design Patterns gibt, wie etwa das Service Locator Pattern, um das IoC-Prinzip anzuwenden, hat sich DI insbesondere in Enterprise-Software als dominantes Pattern etabliert.

Um das Prinzip von IoC zu veranschaulichen, hier ein Beispiel:

```typescript
import { HttpClient } from 'http-library';

class UserRepository {
    async getUsers(): Promise<Users> {
        const client = new HttpClient();
        return await client.get('/users');
    }
}
```

Die Klasse UserRepository hat einen HttpClient als Dependency. Diese Dependency ist an sich nichts Besonderes, problematisch ist jedoch, dass `UserRepository` den HttpClient selbst erzeugt.
Es scheint eine gute Idee zu sein, die Erstellung des HttpClient in der UserRepository zu kapseln, aber das ist nicht der Fall. Was, wenn wir den HttpClient austauschen wollen? Was, wenn wir UserRepository in einem Unit Test testen wollen, ohne echte HTTP-Requests rauszulassen? Woher wissen wir, dass die Klasse überhaupt einen HttpClient verwendet?

## Inversion of Control

Im Sinne der Inversion of Control (IoC) gibt es folgende alternative Variante, die den HttpClient als explizite Dependency im Konstruktor festlegt (auch bekannt als Constructor Injection).

```typescript
class UserRepository {
    constructor(
        private http: HttpClient
    ) {}

    async getUsers(): Promise<Users> {
        return await this.http.get('/users');
    }
}
```

Nun ist nicht mehr UserRepository für die Erstellung des HttpClient zuständig, sondern der Nutzer von UserRepository. Das ist Inversion of Control (IoC). Die Kontrolle wurde umgekehrt bzw. invertiert. Konkret wendet dieser Code Dependency Injection an, weil Dependencies empfangen (injiziert) und nicht mehr erstellt oder angefordert werden. Dependency Injection ist nur eine Variante von IoC.

## Service Locator

Neben DI ist Service Locator (SL) ebenfalls eine Möglichkeit, das IoC-Prinzip anzuwenden. Dies gilt gemeinhin als Gegenstück zu Dependency Injection, da Dependencies angefordert statt empfangen werden. Würde HttpClient im obigen Code wie folgt angefordert, spräche man vom Service Locator Pattern.

```typescript
class UserRepository {
    async getUsers(): Promise<Users> {
        const client = locator.getHttpClient();
        return await client.get('/users');
    }
}
```

Die Function `locator.getHttpClient` kann jeden beliebigen Namen haben. Alternativen wären Funktionsaufrufe wie `useContext(HttpClient)`, `getHttpClient()`, `await import("client")`, oder Container-Abfragen wie `container.get(HttpClient)` oder `container.http`. Ein Import eines Globals ist eine leicht andere Variante eines Service Locators, bei der das Modulsystem selbst als Locator dient:

```typescript
import { httpClient } from 'clients'

class UserRepository {
    async getUsers(): Promise<Users> {
        return await httpClient.get('/users');
    }
}
```

Allen diesen Varianten ist gemeinsam, dass sie die HttpClient-Dependency explizit anfordern und der Code sich bewusst ist, dass es einen Service-Container gibt. Das koppelt den Code stark an das Framework und ist etwas, das man vermeiden möchte, um den Code sauber zu halten.

Die Service-Anforderung kann nicht nur an Properties als Default-Wert erfolgen, sondern auch irgendwo mitten im Code. Da „mitten im Code“ bedeutet, dass es nicht Teil eines Type-Interfaces ist, bleibt die Verwendung des HttpClient verborgen. Je nach Variante, wie der HttpClient angefordert wird, kann es mitunter sehr schwierig oder völlig unmöglich sein, ihn durch eine andere Implementation zu ersetzen. Gerade im Bereich von Unit Tests und der Übersichtlichkeit können hier Schwierigkeiten entstehen, sodass der Service Locator in bestimmten Situationen als Anti-Pattern eingestuft wird.

## Dependency Injection

Bei Dependency Injection wird nichts angefordert, sondern es wird vom Nutzer explizit bereitgestellt oder vom Code empfangen. Der Consumer hat keinen Zugriff auf einen Service-Container und weiß nicht, wie `HttpClient` erstellt oder bezogen wird. Im Kern ermöglicht es, den Code vom IoC-Framework zu entkoppeln und damit sauberer zu halten.

Es wird lediglich deklariert, dass ein `HttpClient` als Typ benötigt wird. Ein entscheidender Unterschied und Vorteil von Dependency Injection gegenüber Service Locator ist, dass Code, der Dependency Injection verwendet, auch ohne jeglichen Service-Container und ohne Service-Identifikationssystem einwandfrei funktioniert (du musst deinem Service keinen Namen geben). Es ist einfach eine Typdeklaration, die auch außerhalb des IoC-Framework-Kontexts funktioniert.

Wie im früheren Beispiel zu sehen, wurde das Dependency Injection Pattern dort bereits angewendet. Konkret ist dort Constructor Injection zu sehen, da die Dependency im Konstruktor deklariert ist. UserRepository muss nun wie folgt instanziert werden.

```typescript
const users = new UserRepository(new HttpClient());
```

Der Code, der UserRepository verwenden möchte, muss auch alle seine Dependencies bereitstellen (injizieren). Ob HttpClient jedes Mal erzeugt werden soll oder jedes Mal derselbe verwendet wird, entscheidet nun der Nutzer der Klasse und nicht mehr die Klasse selbst. Er wird nicht mehr angefordert (aus Sicht der Klasse) wie beim Service Locator oder vollständig selbst erstellt wie im anfänglichen Beispiel. Diese Umkehrung des Flusses hat verschiedene Vorteile:

* Der Code ist leichter verständlich, da alle Dependencies explizit sichtbar sind.
* Der Code ist leichter zu testen, da alle Dependencies eindeutig und bei Bedarf leicht veränderbar sind.
* Der Code ist modularer, da Dependencies leicht austauschbar sind.
* Es fördert das „Separation of Concerns“-Prinzip, da UserRepository nicht mehr selbst für die Erstellung sehr komplexer Dependencies verantwortlich ist.

Ein offensichtlicher Nachteil zeigt sich jedoch direkt: Muss ich wirklich alle Dependencies wie den HttpClient selbst erstellen oder verwalten? Ja und nein. Ja, es gibt viele Fälle, in denen es völlig legitim ist, die Dependencies selbst zu verwalten. Das Kennzeichen einer guten API ist, dass Dependencies nicht aus dem Ruder laufen und sich selbst dann angenehm nutzen lassen. Für viele Anwendungen oder komplexe Bibliotheken kann das durchaus zutreffen. Um eine sehr komplexe Low-Level-API mit vielen Dependencies dem Nutzer vereinfacht bereitzustellen, eignet sich das Facade Pattern hervorragend.

## Dependency Injection Container

Für komplexere Anwendungen ist es jedoch nicht nötig, alle Dependencies selbst zu verwalten, denn genau dafür ist ein sogenannter Dependency Injection Container da. Dieser erstellt nicht nur alle Objekte automatisch, sondern „injiziert“ die Dependencies ebenfalls automatisch, sodass ein manueller „new“-Aufruf nicht mehr notwendig ist. Es gibt verschiedene Arten der Injection, wie Constructor Injection, Method Injection oder Property Injection. So lassen sich auch komplizierte Architekturen mit vielen Dependencies leicht verwalten.

Einen Dependency Injection Container bringt Deepkit in `@deepkit/injector` mit oder bereits fertig integriert über App-Module im Deepkit Framework. Der obige Code sähe unter Verwendung einer Low-Level-API aus dem `@deepkit/injector`-Package so aus:

```typescript
import { InjectorContext } from '@deepkit/injector';

const injector = InjectorContext.forProviders(
    [UserRepository, HttpClient]
);

const userRepo = injector.get(UserRepository);

const users = await userRepo.getUsers();
```

Das `injector`-Objekt ist in diesem Fall der Dependency Injection Container. Anstatt „new UserRepository“ zu verwenden, gibt der Container mittels `get(UserRepository)` eine Instanz von UserRepository zurück. Um den Container statisch zu initialisieren, wird der Function `InjectorContext.forProviders` eine Liste von Providern übergeben (in diesem Fall einfach die Klassen).
Da es bei DI darum geht, Dependencies bereitzustellen, wird der Container mit den Dependencies versorgt, daher der Fachbegriff „Provider“.

Es gibt mehrere Arten von Providern: ClassProvider, ValueProvider, ExistingProvider, FactoryProvider. Zusammen ermöglichen sie es, sehr flexible Architekturen mit einem DI-Container abzubilden.

Alle Dependencies zwischen Providern werden automatisch aufgelöst und sobald ein `injector.get()`-Aufruf erfolgt, werden die Objekte und Dependencies erstellt, gecached und korrekt entweder als Konstruktor-Argument (Constructor Injection), als Property gesetzt (Property Injection) oder an einen Methodenaufruf übergeben (Method Injection).

Um nun den HttpClient gegen einen anderen auszutauschen, kann ein weiterer Provider (hier der ValueProvider) für HttpClient definiert werden:

```typescript
const injector = InjectorContext.forProviders([
    UserRepository,
    {provide: HttpClient, useValue: new AnotherHttpClient()},
]);
```

Sobald UserRepository über `injector.get(UserRepository)` angefordert wird, erhält es das AnotherHttpClient-Objekt. Alternativ kann hier sehr gut ein ClassProvider verwendet werden, sodass auch alle Dependencies von AnotherHttpClient vom DI-Container verwaltet werden.

```typescript
const injector = InjectorContext.forProviders([
    UserRepository,
    {provide: HttpClient, useClass: AnotherHttpClient},
]);
```

Alle Arten von Providern sind im Abschnitt [Dependency Injection Providers](./dependency-injection/providers.md) aufgelistet und erklärt.

Es sei hier erwähnt, dass Deepkits DI-Container nur mit Deepkits Runtime Types funktioniert. Das bedeutet, dass jeder Code, der Klassen, Types, Interfaces und Functions enthält, vom Deepkit Type Compiler kompiliert werden muss, um die Typinformationen zur Laufzeit verfügbar zu haben. Siehe das Kapitel [Runtime Types](./runtime-types.md).

## Dependency Inversion

Das Beispiel von UserRepository oben zeigt, dass UserRepository von einer Low-Level-HTTP-Library abhängt. Zudem wird eine konkrete Implementation (Class) statt einer Abstraktion (Interface) als Dependency deklariert. Auf den ersten Blick scheint dies den objektorientierten Paradigmen zu entsprechen, kann aber insbesondere in komplexen und großen Architekturen zu Problemen führen.

Eine alternative Variante wäre, die HttpClient-Dependency in eine Abstraktion (Interface) zu überführen und damit keinen Code aus einer HTTP-Library in UserRepository zu importieren.

```typescript
interface HttpClientInterface {
   get(path: string): Promise<any>;
}

class UserRepository {
    concstructor(
        private http: HttpClientInterface
    ) {}

    async getUsers(): Promise<Users> {
        return await this.http.get('/users');
    }
}
```

Dies nennt man das Dependency Inversion Principle. UserRepository hat nun keine direkte Dependency mehr auf eine HTTP-Library und basiert stattdessen auf einer Abstraktion (Interface). Es erfüllt damit zwei grundlegende Ziele dieses Prinzips:

* High-Level-Module sollten nichts aus Low-Level-Modulen importieren.
* Implementationen sollten auf Abstraktionen (Interfaces) basieren.

Das Zusammenführen der beiden Implementationen (UserRepository mit einer HTTP-Library) kann nun über den DI-Container erfolgen.

```typescript
import { InjectorContext } from '@deepkit/injector';
import { HttpClient } from './http-client';
import { UserRepository } from './user-repository';

const injector = InjectorContext.forProviders([
    UserRepository,
    HttpClient,
]);
```

Da der DI-Container von Deepkit in der Lage ist, abstrakte Dependencies (Interfaces) wie diese von HttpClientInterface aufzulösen, erhält UserRepository automatisch die Implementation von HttpClient, da HttpClient das Interface HttpClientInterface implementiert hat.

Dies geschieht entweder dadurch, dass HttpClient explizit HttpClientInterface implementiert (`class HttpClient implements HttpClientInterface`), oder dadurch, dass die API von HttpClient einfach mit HttpClientInterface kompatibel ist.

Sobald HttpClient seine API verändert (zum Beispiel die `get`-Methode entfernt) und damit nicht mehr mit HttpClientInterface kompatibel ist, wirft der DI-Container einen Error ("the HttpClientInterface dependency was not provided"). Hier ist der Nutzer, der beide Implementationen zusammenbringen möchte, in der Pflicht, eine Lösung zu finden. Als Beispiel könnte hier eine Adapter-Klasse registriert werden, die HttpClientInterface implementiert und die Methodenaufrufe korrekt an HttpClient weiterleitet.

Alternativ kann das HttpClientInterface direkt mit einer konkreten Implementation bereitgestellt werden.

```typescript
import { InjectorContext, provide } from '@deepkit/injector';
import { HttpClient } from './http-client';
import { UserRepository, HttpClientInterface } from './user-repository';

const injector = InjectorContext.forProviders([
    UserRepository,
    provide<HttpClientInterface>({useClass: HttpClient}),
]);
```

Es ist zu beachten, dass das Dependency Inversion Principle zwar in der Theorie seine Vorteile hat, in der Praxis jedoch auch erhebliche Nachteile mit sich bringt. Es führt nicht nur zu mehr Code (da mehr Interfaces geschrieben werden müssen), sondern auch zu mehr Komplexität (da jede Implementation nun für jede Dependency ein Interface hat). Dieser Preis lohnt sich erst, wenn die Anwendung eine gewisse Größe erreicht und diese Flexibilität benötigt wird. Wie jedes Design Pattern und Prinzip hat auch dieses seinen Kosten-Nutzen-Faktor, der durchdacht werden sollte, bevor es angewendet wird.

Design Patterns sollten nicht blind und flächendeckend selbst für den einfachsten Code eingesetzt werden. Sind jedoch die Voraussetzungen wie eine komplexe Architektur, große Anwendungen oder ein skalierendes Team gegeben, entfalten Dependency Inversion und andere Design Patterns erst ihre wahre Stärke.