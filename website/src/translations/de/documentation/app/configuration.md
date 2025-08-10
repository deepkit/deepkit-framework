# Konfiguration

In Deepkit-Anwendungen können Module und Ihre Anwendung Konfigurationsoptionen haben. 
Eine Konfiguration kann z. B. aus Datenbank-URLs, Passwörtern, IPs usw. bestehen. Services, HTTP/RPC/CLI-Controller und Template-Funktionen können diese Konfigurationsoptionen über Dependency Injection auslesen.

Eine Konfiguration kann definiert werden, indem eine Class mit Properties definiert wird. Dies ist eine typesafe Möglichkeit, eine Konfiguration für Ihre gesamte Anwendung zu definieren, und ihre Werte werden automatisch serialisiert und validiert.

## Beispiel

```typescript
import { MinLength } from '@deepkit/type';
import { App } from '@deepkit/app';

class Config {
    pageTitle: string & MinLength<2> = 'Cool site';
    domain: string = 'example.com';
    debug: boolean = false;
}

const app = new App({
    config: Config
});


app.command('print-config', (config: Config) => {
    console.log('config', config);
})

app.run();
```

```sh
$ curl http://localhost:8080/
Hello from Cool site via example.com
```

Wenn kein Konfigurations-Loader verwendet wird, werden die Default-Werte verwendet. Um die Konfiguration zu ändern, können Sie entweder die `app.configure({domain: 'localhost'})` Method verwenden oder einen Environment Configuration Loader benutzen.

## Konfigurationswerte setzen

Standardmäßig werden keine Werte überschrieben, daher werden Default-Werte verwendet. Es gibt mehrere Möglichkeiten, Konfigurationswerte zu setzen.

* Über `app.configure({})`
* Umgebungsvariablen für jede Option
* Umgebungsvariable via JSON
* dotenv-Dateien

Sie können mehrere Methoden gleichzeitig verwenden, um die Konfiguration zu laden. Die Reihenfolge, in der sie aufgerufen werden, ist wichtig.

### Umgebungsvariablen

Um jede Konfigurationsoption über ihre eigene Umgebungsvariable setzen zu können, verwenden Sie `loadConfigFromEnv`. Der Default-Prefix ist `APP_`, kann aber geändert werden. Außerdem lädt es automatisch `.env`-Dateien. Standardmäßig wird eine Uppercase-Naming-Strategie verwendet, die Sie ebenfalls ändern können.

Für Konfigurationsoptionen wie `pageTitle` oben können Sie `APP_PAGE_TITLE="Other Title"` verwenden, um den Wert zu ändern.

```typescript
new App({
    config: config,
    controllers: [MyWebsite],
})
    .loadConfigFromEnv({prefix: 'APP_'})
    .run();
```

```sh
APP_PAGE_TITLE="Other title" ts-node app.ts server:start
```

### JSON-Umgebungsvariable

Um mehrere Konfigurationsoptionen über eine einzelne Umgebungsvariable zu ändern, verwenden Sie `loadConfigFromEnvVariable`. Das erste Argument ist der Name der Umgebungsvariablen.

```typescript
new App({
    config: config,
    controllers: [MyWebsite],
})
    .loadConfigFromEnvVariable('APP_CONFIG')
    .run();
```

```sh
APP_CONFIG='{"pageTitle": "Other title"}' ts-node app.ts server:start
```

### DotEnv-Dateien

Um mehrere Konfigurationsoptionen über eine dotenv-Datei zu ändern, verwenden Sie `loadConfigFromEnv`. Das erste Argument ist entweder ein Pfad zu einer dotenv (relativ zu `cwd`) oder mehrere Pfade. Handelt es sich um ein Array, wird jeder Pfad ausprobiert, bis eine existierende Datei gefunden wird.

```typescript
new App({
    config: config,
    controllers: [MyWebsite],
})
    .loadConfigFromEnv({envFilePath: ['production.dotenv', 'dotenv']})
    .run();
```

```sh
$ cat dotenv
APP_PAGE_TITLE=Other title
$ ts-node app.ts server:start
```

### Modulkonfiguration

Jedes importierte Modul kann einen Modulnamen haben. Dieser Name wird für die oben verwendeten Konfigurationspfade benutzt.

Zum Beispiel ist beim Konfigurieren per Umgebungsvariablen der Pfad für die Option port des `FrameworkModule` `FRAMEWORK_PORT`. Alle Namen werden standardmäßig in Großbuchstaben geschrieben. Wird ein Prefix `APP_` verwendet, kann der Port wie folgt geändert werden:

```sh
$ APP_FRAMEWORK_PORT=9999 ts-node app.ts server:start
2021-06-12T18:59:26.363Z [LOG] Start HTTP server, using 1 workers.
2021-06-12T18:59:26.365Z [LOG] HTTP MyWebsite
2021-06-12T18:59:26.366Z [LOG]     GET / helloWorld
2021-06-12T18:59:26.366Z [LOG] HTTP listening at http://localhost:9999/
```

In dotenv-Dateien wäre es ebenfalls `APP_FRAMEWORK_PORT=9999`.

In JSON-Umgebungsvariablen über `loadConfigFromEnvVariable('APP_CONFIG')` hingegen entspricht es der Struktur der eigentlichen Konfigurations-Class. `framework` wird zu einem Object.

```sh
$ APP_CONFIG='{"framework": {"port": 9999}}' ts-node app.ts server:start
```

Das funktioniert für alle Module gleich. Für die Konfigurationsoption Ihrer Anwendung (`new App`) ist kein Modul-Prefix erforderlich.


## Konfigurationsklasse

```typescript
import { MinLength } from '@deepkit/type';

export class Config {
    title!: string & MinLength<2>; //dadurch wird es erforderlich und muss angegeben werden
    host?: string;

    debug: boolean = false; //Default-Werte werden ebenfalls unterstützt
}
```

```typescript
import { createModuleClass } from '@deepkit/app';
import { Config } from './module.config.ts';

export class MyModule extends createModuleClass({
  config: Config
}) {
}
```

Die Werte für die Konfigurationsoptionen können entweder im Konstruktor des Moduls, mit der `.configure()` Method, oder über Configuration Loader bereitgestellt werden (z. B. Environment Variable Loader).

```typescript
import { MyModule } from './module.ts';

new App({
   imports: [new MyModule({title: 'Hello World'})],
}).run();
```

Um die Konfigurationsoptionen eines importierten Moduls dynamisch zu ändern, können Sie den `process` Hook verwenden. Dies ist ein guter Ort, um entweder Konfigurationsoptionen weiterzureichen oder ein importiertes Modul abhängig von der aktuellen Modulkonfiguration oder anderen Modulinstanz-Informationen einzurichten.

```typescript
import { MyModule } from './module.ts';

export class MainModule extends createModuleClass({
}) {
    process() {
        this.getImportedModuleByClass(MyModule).configure({title: 'Changed'});
    }
}
```

Auf Anwendungsebene funktioniert es ein wenig anders:

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

## Konfigurationswerte lesen

Um eine Konfigurationsoption in einem Service zu verwenden, können Sie normale Dependency Injection nutzen. Es ist möglich, entweder das gesamte Konfigurations-Object, einen einzelnen Wert oder einen Teil der Konfiguration zu injizieren.

### Teilmenge

Um nur eine Teilmenge der Konfigurationswerte zu injizieren, verwenden Sie den `Pick` Type.

```typescript
import { Config } from './module.config';

export class MyService {
     constructor(private config: Pick<Config, 'title' | 'host'}) {
     }

     getTitle() {
         return this.config.title;
     }
}


//In Unit-Tests kann es wie folgt instanziiert werden
new MyService({title: 'Hello', host: '0.0.0.0'});

//oder Sie verwenden Type Aliases
type MyServiceConfig = Pick<Config, 'title' | 'host'};
export class MyService {
     constructor(private config: MyServiceConfig) {
     }
}
```

### Einzelner Wert

Um nur einen einzelnen Wert zu injizieren, verwenden Sie den Indexzugriffsoperator.

```typescript
import { Config } from './module.config';

export class MyService {
     constructor(private title: Config['title']) {
     }

     getTitle() {
         return this.title;
     }
}
```

### Alle

Um alle Config-Werte zu injizieren, verwenden Sie die Class als Dependency.

```typescript
import { Config } from './module.config';

export class MyService {
     constructor(private config: Config) {
     }

     getTitle() {
         return this.config.title;
     }
}
```