# Deepkit Framework

Das Deepkit Framework basiert auf [Deepkit App](./app.md) in `@deepkit/app` und stellt das Modul `FrameworkModule` in `@deepkit/framework` bereit, das in Ihrer Anwendung importiert werden kann.

Die `App`-Abstraktion bringt:

- CLI-Befehle
- Konfigurationsladen (Environment, Dotfiles, benutzerdefiniert)
- Modul-System
- Leistungsfähiger Service-Container
- Registry und Hooks für Controller, Provider, Listener und mehr

Das Modul `FrameworkModule` bringt zusätzliche Funktionen:

- Anwendungsserver
    - HTTP-Server
    - RPC-Server
    - Multi-Prozess-Lastverteilung
    - SSL
- Debugging-CLI-Befehle
- Konfiguration/Befehle für Database Migration
- Debugging/Profiler-GUI über die Option `{debug: true}`
- Interaktive API-Dokumentation (ähnlich Swagger)
- Provider für DatabaseRegistry, ProcessLocking, Broker, Sessions
- Integration-Test-APIs

Sie können Anwendungen mit oder ohne das `FrameworkModule` schreiben.

## Installation

Das Deepkit Framework basiert auf [Deepkit App](./app.md). Stellen Sie sicher, dass Sie dessen Installationsanweisungen befolgt haben.
Falls ja, können Sie das Deepkit Framework installieren und das `FrameworkModule` in Ihre `App` importieren. 

```sh
npm install @deepkit/framework
```

```typescript
import { App } from '@deepkit/app';
import { FrameworkModule } from '@deepkit/framework';

const app = new App({
    imports: [new FrameworkModule({ debug: true })]
});

app.command('test', (logger: Logger) => {
    logger.log('Hello World!');
});

app.run();
```

Da die App jetzt das `FrameworkModule` importiert, sehen wir, dass mehr Befehle verfügbar sind, gruppiert nach Themen.

Einer davon ist `server:start`, der den HTTP-Server startet. Um ihn zu verwenden, müssen wir mindestens eine HTTP-Route registrieren.

```typescript
import { App } from '@deepkit/app';
import { HttpRouterRegistry } from '@deepkit/http';

const app = new App({
    imports: [new FrameworkModule({ debug: true })]
});

app.command('test', (logger: Logger) => {
    logger.log('Hello World!');
});


const router = app.get(HttpRouterRegistry);

router.get('/', () => {
    return 'Hello World';
})

app.run();
```

Wenn Sie den Befehl `server:start` erneut ausführen, sehen Sie, dass der HTTP-Server nun gestartet ist und die Route `/` verfügbar ist.

```sh
$ ./node_modules/.bin/ts-node ./app.ts server:start
```

```sh
$ curl http://localhost:8080/
Hello World
```

Um Anfragen zu bedienen, lesen Sie bitte das Kapitel [HTTP](http.md) oder [RPC](rpc.md). Im Kapitel [App](app.md) erfahren Sie mehr über CLI-Befehle.

## App

Die `App`-Klasse ist der Haupteinstiegspunkt für Ihre Anwendung. Sie ist verantwortlich für das Laden aller Module, der Konfiguration und das Starten der Anwendung.
Sie ist außerdem dafür verantwortlich, alle CLI-Befehle zu laden und auszuführen. Module wie FrameworkModule stellen zusätzliche Befehle bereit, registrieren Event-Listener,
stellen Controller für HTTP/RPC, Service-Provider und so weiter bereit.

Dieses `app`-Objekt kann auch verwendet werden, um auf den Dependency-Injection-Container zuzugreifen, ohne einen CLI-Controller auszuführen.

```typescript
const app = new App({
    imports: [new FrameworkModule]
});

// Zugriff auf alle registrierten Services
const eventDispatcher = app.get(EventDispatcher);
```

Sie können den `EventDispatcher` abrufen, weil das `FrameworkModule` ihn als Service-Provider registriert, wie viele andere (Logger, ApplicationServer und [vieles mehr](https://github.com/deepkit/deepkit-framework/blob/master/packages/framework/src/module.ts)).

Sie können auch Ihren eigenen Service registrieren.

```typescript

class MyService {
    constructor(private logger: Logger) {
    }

    helloWorld() {
        this.logger.log('Hello World');
    }
}

const app = new App({
    providers: [MyService],
    imports: [new FrameworkModule]
});

const service = app.get(MyService);

service.helloWorld();
```

### Debugger

Die Konfigurationswerte Ihrer Anwendung und aller Module können im Debugger angezeigt werden. Aktivieren Sie die Option `debug` im `FrameworkModule` und öffnen Sie `http://localhost:8080/_debug/configuration`.

```typescript
import { App } from '@deepkit/app';
import { FrameworkModule } from '@deepkit/framework';

new App({
    config: Config,
    controllers: [MyWebsite],
    imports: [
        new FrameworkModule({
            debug: true,
        })
    ]
}).run();
```

![Debugger-Konfiguration](/assets/documentation/framework/debugger-configuration.png)

Sie können auch `ts-node app.ts app:config` verwenden, um alle verfügbaren Konfigurationsoptionen, den aktiven Wert, ihren Standardwert, Beschreibung und Datentyp anzuzeigen.

```sh
$ ts-node app.ts app:config
Application config
┌─────────┬───────────────┬────────────────────────┬────────────────────────┬─────────────┬───────────┐
│ (index) │     name      │         value          │      defaultValue      │ description │   type    │
├─────────┼───────────────┼────────────────────────┼────────────────────────┼─────────────┼───────────┤
│    0    │  'pageTitle'  │     'Other title'      │      'Cool site'       │     ''      │ 'string'  │
│    1    │   'domain'    │     'example.com'      │     'example.com'      │     ''      │ 'string'  │
│    2    │    'port'     │          8080          │          8080          │     ''      │ 'number'  │
│    3    │ 'databaseUrl' │ 'mongodb://localhost/' │ 'mongodb://localhost/' │     ''      │ 'string'  │
│    4    │    'email'    │         false          │         false          │     ''      │ 'boolean' │
│    5    │ 'emailSender' │       undefined        │       undefined        │     ''      │ 'string?' │
└─────────┴───────────────┴────────────────────────┴────────────────────────┴─────────────┴───────────┘
Modules config
┌─────────┬──────────────────────────────┬─────────────────┬─────────────────┬────────────────────────────────────────────────────────────────────────────────────────────────────┬────────────┐
│ (index) │           name               │      value      │  defaultValue   │                                            description                                             │    type    │
├─────────┼──────────────────────────────┼─────────────────┼─────────────────┼────────────────────────────────────────────────────────────────────────────────────────────────────┼────────────┤
│    0    │       'framework.host'       │   'localhost'   │   'localhost'   │                                                 ''                                                 │  'string'  │
│    1    │       'framework.port'       │      8080       │      8080       │                                                 ''                                                 │  'number'  │
│    2    │    'framework.httpsPort'     │    undefined    │    undefined    │ 'If httpsPort and ssl is defined, then the https server is started additional to the http-server.' │ 'number?'  │
│    3    │    'framework.selfSigned'    │    undefined    │    undefined    │           'If for ssl: true the certificate and key should be automatically generated.'            │ 'boolean?' │
│    4    │ 'framework.keepAliveTimeout' │    undefined    │    undefined    │                                                 ''                                                 │ 'number?'  │
│    5    │       'framework.path'       │       '/'       │       '/'       │                                                 ''                                                 │  'string'  │
│    6    │     'framework.workers'      │        1        │        1        │                                                 ''                                                 │  'number'  │
│    7    │       'framework.ssl'        │      false      │      false      │                                       'Enables HTTPS server'                                       │ 'boolean'  │
│    8    │    'framework.sslOptions'    │    undefined    │    undefined    │                   'Same interface as tls.SecureContextOptions & tls.TlsOptions.'                   │   'any'    │
...
```

## Anwendungsserver

## Dateistruktur

## Auto-CRUD

## Events

Das Deepkit-Framework wird mit verschiedenen Event-Tokens geliefert, auf die Event-Listener registriert werden können.

Siehe das Kapitel [Events](./app/events.md), um mehr darüber zu erfahren, wie Events funktionieren.

### Events senden

Events werden über die `EventDispatcher`-Klasse gesendet. In einer Deepkit-App kann dieser über Dependency Injection bereitgestellt werden.

```typescript
import { cli, Command } from '@deepkit/app';
import { EventDispatcher } from '@deepkit/event';

@cli.controller('test')
export class TestCommand implements Command {
    constructor(protected eventDispatcher: EventDispatcher) {
    }

    async execute() {
        this.eventDispatcher.dispatch(UserAdded, new UserEvent({ username: 'Peter' }));
    }
}
```