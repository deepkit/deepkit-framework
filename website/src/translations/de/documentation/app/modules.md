# Module

Deepkit ist hochgradig modular und ermöglicht es Ihnen, Ihre Anwendung in mehrere praktische Module aufzuteilen. Jedes Modul hat seinen eigenen Dependency-Injection-Subcontainer (der alle übergeordneten Provider erbt), Konfiguration, Befehle und vieles mehr.
Im Kapitel [Erste Schritte](../framework.md) haben Sie bereits ein Modul erstellt – das Root-Modul. `new App` nimmt fast die gleichen Argumente wie ein Modul entgegen, da es im Hintergrund automatisch das Root-Modul für Sie erstellt.

Sie können dieses Kapitel überspringen, wenn Sie nicht planen, Ihre Anwendung in Submodule aufzuteilen, oder wenn Sie nicht vorhaben, ein Modul als Paket für andere verfügbar zu machen.

Ein Modul kann entweder als Klassenmodul oder als Funktionsmodul definiert werden.

```typescript title=Klassenmodul
import { createModuleClass } from '@deepkit/app';

export class MyModule extends createModuleClass({
  //gleiche Optionen wie new App({})
  providers: [MyService]
}) {
}
```

```typescript title=Funktionsmodul
import { AppModule } from '@deepkit/app';

export function myModule(options: {} = {}) {
    return (module: AppModule) => {
        module.addProvider(MyService);
    };
}
```

Dieses Modul kann dann in Ihre Anwendung oder andere Module importiert werden.

```typescript
import { MyModule, myModule } from './module.ts'

new App({
    imports: [
        new MyModule(), //Klassenmodul importieren
        myModule(), //Funktionsmodul importieren
    ]
}).run();
```

Sie können diesem Modul nun Funktionen hinzufügen, wie Sie es auch mit `App` tun würden. Die Argumente von `createModule` sind dieselben, mit der Ausnahme, dass Importe in einer Moduldefinition nicht verfügbar sind.
Für Funktionsrouten können Sie die Methoden von `AppModule` verwenden, um es dynamisch basierend auf Ihren eigenen Optionen zu konfigurieren.

Fügen Sie HTTP/RPC/CLI-Controller, Services, eine Konfiguration, Event-Listener und verschiedene Modul-Hooks hinzu, um Module dynamischer zu machen.

## Controller

Module können Controller definieren, die von anderen Modulen verarbeitet werden. Wenn Sie beispielsweise einen Controller mit Decorators aus dem Paket `@deepkit/http` hinzufügen, wird dessen `HttpModule` dies erkennen und die gefundenen Routen in seinem Router registrieren. Ein einzelner Controller kann mehrere solcher Decorators enthalten. Es liegt beim Autor des Moduls, der Ihnen diese Decorators zur Verfügung stellt, wie er die Controller verarbeitet.

In Deepkit gibt es drei Pakete, die solche Controller verarbeiten: HTTP, RPC und CLI. Siehe deren jeweilige Kapitel, um mehr zu erfahren. Unten ist ein Beispiel für einen HTTP-Controller:

```typescript
import { createModuleClass } from '@deepkit/app';
import { http } from '@deepkit/http';
import { injectable } from '@deepkit/injector';

class MyHttpController {
  @http.GET('/hello)
  hello() {
    return 'Hello world!';
  }
}

export class MyModule extends createModuleClass({
  controllers: [MyHttpController]
}) {
}


//gleiches ist für App möglich
new App({
  controllers: [MyHttpController]
}).run();
```

## Provider

Wenn Sie in Ihrer Anwendung einen Provider im Abschnitt `providers` definieren, ist er in der gesamten Anwendung zugänglich. Bei Modulen jedoch werden diese Provider automatisch im Dependency-Injection-Subcontainer dieses Moduls gekapselt. Sie müssen jeden Provider manuell exportieren, um ihn für ein anderes Modul oder Ihre Anwendung verfügbar zu machen.

Um mehr darüber zu erfahren, wie Provider funktionieren, lesen Sie das Kapitel [Abhängigkeitsinjektion](../dependency-injection.md).

```typescript
import { createModuleClass } from '@deepkit/app';
import { http } from '@deepkit/http';
import { injectable } from '@deepkit/injector';

export class HelloWorldService {
  helloWorld() {
    return 'Hello there!';
  }
}

class MyHttpController {
  constructor(private helloService: HelloWorldService) {
  }

  @http.GET('/hello)
  hello() {
    return this.helloService.helloWorld();
  }
}

export class MyModule extends createModuleClass({
  controllers: [MyHttpController],
  providers: [HelloWorldService],
}) {
}

export function myModule(options: {} = {}) {
  return (module: AppModule) => {
    module.addController(MyHttpController);
    module.addProvider(HelloWorldService);
  };
}

//gleiches ist für App möglich
new App({
  controllers: [MyHttpController],
  providers: [HelloWorldService],
}).run();
```

Wenn ein Benutzer dieses Modul importiert, hat er keinen Zugriff auf `HelloWorldService`, da es im Sub-Dependency-Injection-Container von `MyModule` gekapselt ist.

## Exporte

Um Provider im Modul des Importeurs verfügbar zu machen, können Sie das Token des Providers in `exports` aufnehmen. Dies verschiebt den Provider im Wesentlichen eine Ebene nach oben in den Dependency-Injection-Container des übergeordneten Moduls – des Importeurs.

```typescript
import { createModuleClass } from '@deepkit/app';

export class MyModule extends createModuleClass({
  exports: [HelloWorldService],
}) {
}

export function myModule(options: {} = {}) {
  return (module: AppModule) => {
    module.addExport(HelloWorldService);
  };
}
```

Wenn Sie andere Provider wie `FactoryProvider`, `UseClassProvider` usw. haben, sollten Sie in den Exports trotzdem nur den Class Type verwenden.

```typescript
import { createModuleClass } from '@deepkit/app';

export class MyModule extends createModuleClass({
  controllers: [MyHttpController]
  providers: [
    { provide: HelloWorldService, useValue: new HelloWorldService }
  ],
  exports: [HelloWorldService],
}) {
}
```

Wir können dieses Modul nun importieren und seinen exportierten Service in unserem Anwendungscode verwenden.

```typescript
import { App } from '@deepkit/app';
import { cli, Command } from '@deepkit/app';
import { HelloWorldService, MyModule } from './my-module';

@cli.controller('test')
export class TestCommand implements Command {
    constructor(protected helloWorld: HelloWorldService) {
    }

    async execute() {
        this.helloWorld.helloWorld();
    }
}

new App({
    controllers: [TestCommand],
    imports: [
        new MyModule(),
    ]
}).run();
```

Lesen Sie das Kapitel [Abhängigkeitsinjektion](../dependency-injection.md), um mehr zu erfahren.


### Konfigurationsschema

Ein Modul kann typsichere Konfigurationsoptionen haben. Die Werte dieser Optionen können teilweise oder vollständig in Services dieses Moduls injiziert werden, indem einfach die Klassenreferenz oder Typfunktionen wie `Partial<Config, 'url'>` verwendet werden. Um ein Konfigurationsschema zu definieren, schreiben Sie eine Klasse mit Properties.

```typescript
export class Config {
    title!: string; //erforderlich und muss bereitgestellt werden
    host?: string; //optional

    debug: boolean = false; //Standardwerte werden ebenfalls unterstützt
}
```

```typescript
import { createModuleClass } from '@deepkit/app';
import { Config } from './module.config.ts';

export class MyModule extends createModuleClass({
  config: Config
}) {
}

export function myModule(options: Partial<Config> = {}) {
  return (module: AppModule) => {
    module.setConfigDefinition(Config).configure(options);
  };
}
```

Konfigurationswerte können entweder über den Konstruktor Ihres Moduls, mit der Methode `.configure()`, oder über Konfigurationslader (z. B. Umgebungsvariablen-Lader) bereitgestellt werden.

```typescript
import { MyModule } from './module.ts';

new App({
   imports: [
       new MyModule({title: 'Hello World'}),
       myModule({title: 'Hello World'}),
   ],
}).run();
```

Um die Konfigurationsoptionen eines importierten Moduls dynamisch zu ändern, können Sie den `process`-Modul-Hook verwenden. Dies ist ein guter Ort, um entweder Konfigurationsoptionen umzuleiten oder ein importiertes Modul abhängig von der aktuellen Moduls-Konfiguration oder anderen Modulinstanz-Informationen einzurichten.


```typescript
import { MyModule } from './module.ts';

export class MainModule extends createModuleClass({
}) {
    process() {
        this.getImportedModuleByClass(MyModule).configure({title: 'Changed'});
    }
}

export function myModule(options: Partial<Config> = {}) {
    return (module: AppModule) => {
        module.getImportedModuleByClass(MyModule).configure({title: 'Changed'});
    };
}
```

Auf Anwendungsebene funktioniert es etwas anders:

```typescript
new App({
    imports: [new MyModule({title: 'Hello World'}],
})
    .setup((module, config) => {
        module.getImportedModuleByClass(MyModule).configure({title: 'Changed'});
    })
    .run();
```

Wenn das Root-Anwendungsmodul aus einem regulären Modul erstellt wird, funktioniert es ähnlich wie bei regulären Modulen.

```typescript
class AppModule extends createModuleClass({
}) {
    process() {
        this.getImportedModuleByClass(MyModule).configure({title: 'Changed'});
    }
}

App.fromModule(new AppModule()).run();
```

## Modulname

Alle Konfigurationsoptionen können auch über Umgebungsvariablen geändert werden. Dies funktioniert nur, wenn dem Modul ein Name zugewiesen wurde. Ein Modulname kann über `createModule` definiert und später bei der Instanzerzeugung dynamisch geändert werden. Letzteres Muster ist nützlich, wenn Sie dasselbe Modul zweimal importiert haben und zwischen ihnen unterscheiden möchten, indem Sie einen neuen Namen setzen.

```typescript
export class MyModule extends createModuleClass({
  name: 'my'
}) {
}

export function myModule(options: Partial<Config> = {}) {
    return (module: AppModule) => {
        module.name = 'my';
    };
}
```

```typescript
import { MyModule } from './module';

new App({
    imports: [
        new MyModule(), //'my' ist der Standardname
        new MyModule().rename('my2'), //'my2' ist jetzt der neue Name
    ]
}).run();
```

Siehe das Kapitel [Konfiguration](./configuration.md) für weitere Informationen darüber, wie Konfigurationsoptionen aus Umgebungsvariablen oder .env-Dateien geladen werden.

## Importe

Module können andere Module importieren, um ihre Funktionalität zu erweitern. In `App` können Sie andere Module im Moduldefinitionsobjekt über `imports: []` importieren:

```typescript
new App({
    imports: [new Module]
}).run();
```

In regulären Modulen ist das nicht möglich, da das Modul in der Objekdefinitionsobjekt-Instanz global werden würde, was normalerweise nicht erwünscht ist. Stattdessen können Module innerhalb des Moduls selbst über die Eigenschaft `imports` instanziiert werden, sodass Instanzen jedes importierten Moduls für jede neue Instanz Ihres Moduls erstellt werden.

```typescript
import { createModuleClass } from '@deepkit/app';

export class MyModule extends createModuleClass({}) {
  imports = [new OtherModule()];
}

export function myModule() {
  return (module: AppModule) => {
    module.addImport(new OtherModule());
  };
}
```

Sie können Module auch dynamisch basierend auf der Konfiguration mit dem Hook `process` importieren.

```typescript
import { createModuleClass } from '@deepkit/app';

export class MyModule extends createModuleClass({}) {
  process() {
    if (this.config.xEnabled) {
      this.addImport(new OtherModule({ option: 'value' });
    }
  }
}

export function myModule(option: { xEnabled?: boolean } = {}) {
  return (module: AppModule) => {
    if (option.xEnabled) {
      module.addImport(new OtherModule());
    }
  };
}
```

## Hooks

Der Service-Container lädt alle Module in der Reihenfolge, in der sie importiert wurden, beginnend beim Root-/Anwendungsmodul.

Während dieses Prozesses führt der Service-Container auch alle registrierten Konfigurationslader aus, ruft `setupConfig`-Callbacks auf und validiert anschließend die Konfigurationsobjekte jedes Moduls.

Der gesamte Prozess des Ladens des Service-Containers ist wie folgt:

1.  Für jedes Modul `T` (beginnend beim Root)
    1. Konfigurationslader ausführen `ConfigLoader.load(T)`.
    2. `T.setupConfig()` aufrufen.
    3. Konfiguration von `T` validieren. Abbrechen, wenn ungültig.
    4. `T.process()` aufrufen.  
       Hier kann das Modul sich selbst basierend auf gültigen Konfigurationsoptionen modifizieren. Neue Importe, Provider usw. hinzufügen.
    5. 1. für jedes importierte Modul von `T` wiederholen.
3. Alle registrierten Module finden.
4. Jedes gefundene Modul `T` verarbeiten.
    1. Middlewares von `T` registrieren.
    2. Listener von `T` im Event-Dispatcher registrieren.
    3. Für alle aus 2. gefundenen Module `Module.processController(T, controller)` aufrufen.
    4. Für alle aus 2. gefundenen Module `Module.processProvider(T, token, provider)` aufrufen.
    5. 3. für jedes importierte Modul von `T` wiederholen.
5. `T.postProcess()` auf allen Modulen ausführen.
6. Die Bootstrap-Klasse auf allen Modulen instanziieren.
7. Der Dependency-Injection-Container ist nun aufgebaut.

Um Hooks zu verwenden, können Sie die Methoden `process`, `processProvider`, `postProcess` in Ihrer Modulkasse registrieren.

```typescript
import { createModuleClass, AppModule } from '@deepkit/app';
import { isClass } from '@deepkit/core';
import { ProviderWithScope, Token } from '@deepkit/injector';

export class MyModule extends createModuleClass({}) {
  imports = [new FrameworkModule()];

  //zuerst ausgeführt
  process() {
    //this.config enthält das vollständig validierte Konfigurationsobjekt.
    if (this.config.environment === 'development') {
      this.getImportedModuleByClass(FrameworkModule).configure({ debug: true });
    }
    this.addModule(new AnotherModule);
    this.addProvider(Service);

    //ruft zusätzliche Setup-Methoden auf. 
    //In diesem Fall wird 'method1' mit den angegebenen Argumenten aufgerufen, wenn 
    //Service vom Dependency-Injection-Container instanziiert wird.
    this.configureProvider<Service>(v => v.method1(this.config.value));
  }

  //für jeden gefundenen Controller in allen Modulen ausgeführt
  processController(module: AppModule<any>, controller: ClassType) {
    //HttpModule prüft beispielsweise bei jedem Controller, ob
    //ein @http Decorator verwendet wurde, und extrahiert in diesem Fall alle Routen-
    //informationen und legt sie im Router ab.
  }

  //für jeden gefundenen Provider in allen Modulen ausgeführt
  processProvider(module: AppModule<any>, token: Token, provider: ProviderWithScope) {
    //FrameworkModule sucht beispielsweise nach bereitgestellten Tokens, die von deepkit/orm Database erweitern,
    //und registriert sie automatisch in einer DatabaseRegistry, sodass sie in den Migration-CLI-Befehlen
    //und im Framework-Debugger verwendet werden können.
  }

  //wird ausgeführt, wenn alle Module verarbeitet wurden.
  //Letzte Chance, Provider über module.configureProvider basierend auf
  //Informationen aus process/processProvider einzurichten. 
  postProcess() {

  }
}
```

## Zustandsbehaftete Module

Da jedes Modul explizit mit `new Module` instanziiert wird, kann das Modul einen Zustand haben. Dieser Zustand kann in den Dependency-Injection-Container injiziert werden, sodass er für Services verfügbar ist.

Betrachten Sie als Beispiel den HttpModule-Anwendungsfall. Es prüft jeden registrierten Controller in der gesamten Anwendung auf bestimmte @http-Decorators und legt den Controller in ein Register, wenn vorhanden. Dieses Register wird in den Router injiziert, der beim Instanziieren alle Routeninformationen dieser Controller extrahiert und registriert.

```typescript
class Registry {
    protected controllers: { module: AppModule<any>, classType: ClassType }[] = [];
        
    register(module: AppModule<any>, controller: ClassType) {
        this.controllers.push({ module, classType: controller });
    }
        
    get(classType: ClassType) {
        const controller = this.controllers.find(v => v.classType === classType);
        if (!controller) throw new Error('Controller unknown');
        return controller;
    }
}
        
class Router {
    constructor(
        protected injectorContext: InjectorContext,
        protected registry: Registry
    ) {
    }
        
    getController(classType: ClassType) {
        //finde classType und Modul für den gegebenen Controller-classType
        const controller = this.registry.get(classType);
        
        //hier wird der Controller instanziiert. Wenn er bereits
        //instanziiert wurde, wird die alte Instanz zurückgegeben (falls der Provider nicht transient: true war)
        return injector.get(controller.classType, controller.module);
    }
}
        
class HttpModule extends createModuleClass({
    providers: [Router],
    exports: [Router],
}) {
    protected registry = new Registry;
        
    process() {
        this.addProvider({ provide: Registry, useValue: this.registry });
    }
        
    processController(module: AppModule<any>, controller: ClassType) {
        //Controller müssen vom Controller-Verbraucher in die Provider des Moduls aufgenommen werden
        if (!module.isProvided(controller)) module.addProvider(controller);
        this.registry.register(module, controller);
    }
}
        
class MyController {}
        
const app = new App({
    controllers: [MyController],
    imports: [new HttpModule()]
});
        
const myController = app.get(Router).getController(MyController);
```

## Für Root

Die Eigenschaft `root` ermöglicht es Ihnen, den Dependency-Injection-Container eines Moduls in den Container der Root-Anwendung zu verschieben. Dadurch wird jeder Service aus dem Modul automatisch in der Root-Anwendung selbst verfügbar. Im Grunde verschiebt dies jeden Provider (Controller, Event-Listener, Provider) in den Root-Container. Dies könnte zu Abhängigkeitskonflikten führen und sollte daher nur für ein Modul verwendet werden, das wirklich nur Globals enthält. Sie sollten stattdessen bevorzugt jeden Provider manuell exportieren.

Wenn Sie eine Bibliothek erstellen, die von vielen Modulen verwendet werden kann, sollten Sie `root` vermeiden, da es mit Provider-Tokens aus anderen Bibliotheken kollidieren könnte. Wenn diese Bibliotheksmodul beispielsweise ein `foo`-Modul importiert, das einen Service definiert, und Sie einige Services nach Ihren Bedürfnissen rekonfigurieren, und die Anwendung des Benutzers dasselbe `foo`-Modul importiert, erhält der Benutzer Ihre rekonfigurierten Services. Für viele einfachere Anwendungsfälle mag das jedoch in Ordnung sein.

```typescript
import { createModuleClass } from '@deepkit/app';

export class MyModule extends createModuleClass({}) {
  root = true;
}
```

Sie können die Eigenschaft `root` eines Drittanbieter-Moduls auch mithilfe von `forRoot()` ändern.

```typescript
new App({
    imports: [new ThirdPartyModule().forRoot()],
}).run();
```

## Injector-Kontext

Der InjectorContext ist der Dependency-Injection-Container. Er ermöglicht es Ihnen, Services aus Ihren eigenen oder anderen Modulen anzufordern/zu instanziieren. Dies ist notwendig, wenn Sie beispielsweise einen Controller in `processControllers` gespeichert haben und ihn korrekt instanziieren möchten.