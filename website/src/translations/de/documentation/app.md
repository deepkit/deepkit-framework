# Deepkit App

Die Abstraktion Deepkit App ist der grundlegendste Baustein einer Deepkit-Anwendung. Hier beginnen Sie in der Regel mit dem Aufbau Ihrer Anwendung, wenn Sie die Bibliotheken nicht eigenständig verwenden.
Es handelt sich um eine normale TypeScript-Datei, die Sie mit einer Laufzeitumgebung wie Node.js ausführen. Sie ist der Einstiegspunkt für Ihre Anwendung und bietet eine Möglichkeit, CLI-Befehle, Services,
Konfiguration, Event-System und mehr zu definieren.

Command-line Interface (CLI)-Programme sind Programme, die über das Terminal in Form von Texteingabe und Textausgabe interagieren. Der Vorteil der Interaktion mit der Anwendung in
dieser Variante besteht darin, dass lediglich ein Terminal entweder lokal oder über eine SSH-Verbindung vorhanden sein muss.

Sie bietet:

- CLI-Befehle
- Modulsystem
- Service-Container
- Dependency Injection
- Ereignissystem
- Logger
- Konfigurationslader (env, dotenv, json)

Ein Befehl in Deepkit hat vollen Zugriff auf den DI-Container und kann dadurch auf alle Provider und Konfigurationsoptionen zugreifen. Die Argumente und Optionen der CLI-Befehle werden über die
Parameterdeklaration mittels TypeScript-Typen gesteuert und automatisch serialisiert und validiert.

[Deepkit Framework](./framework.md) mit `@deepkit/framework` erweitert dies um einen Anwendungsserver für HTTP/RPC, einen Debugger/Profiler und vieles mehr.

## Einfache Installation

Am einfachsten ist der Einstieg mit NPM init, um ein neues Deepkit-Projekt zu erstellen.

```shell
npm init @deepkit/app@latest my-deepkit-app
````

Dadurch wird ein neuer Ordner `my-deepkit-app` mit allen Abhängigkeiten und einer grundlegenden `app.ts`-Datei erstellt.

```sh
cd my-deepkit-app
npm run app
````

Dies führt die Datei `app.ts` mit `ts-node` aus und zeigt Ihnen die verfügbaren Befehle an. Von hier aus können Sie beginnen und eigene Befehle, Controller und so weiter hinzufügen.

## Manuelle Installation

Deepkit App basiert auf [Deepkit Runtime Types](./runtime-types.md), daher installieren wir alle Abhängigkeiten:

```bash
mkdir my-project && cd my-project

npm install typescript ts-node 
npm install @deepkit/app @deepkit/type @deepkit/type-compiler
```

Als Nächstes stellen wir sicher, dass Deepkits Type-Compiler in das installierte TypeScript-Paket unter `node_modules/typescript` installiert wird, indem wir den folgenden Befehl ausführen:

```sh
./node_modules/.bin/deepkit-type-install
```

Stellen Sie sicher, dass alle Peer-Abhängigkeiten installiert sind. Standardmäßig installiert NPM 7+ diese automatisch.

Zum Kompilieren Ihrer Anwendung benötigen wir den TypeScript-Compiler und empfehlen `ts-node`, um die App einfach auszuführen.

Eine Alternative zur Verwendung von `ts-node` besteht darin, den Quellcode mit dem TypeScript-Compiler zu kompilieren und den JavaScript-Quellcode direkt auszuführen. Dies hat den Vorteil, die Ausführungsgeschwindigkeit für kurze Befehle drastisch zu erhöhen. Es erzeugt jedoch zusätzlichen Workflow-Overhead, entweder durch manuelles Ausführen des Compilers oder das Einrichten eines Watchers. Aus diesem Grund wird in allen Beispielen in dieser Dokumentation `ts-node` verwendet.

## Erste Anwendung

Da das Deepkit-Framework keine Konfigurationsdateien oder eine spezielle Ordnerstruktur verwendet, können Sie Ihr Projekt beliebig strukturieren. Die einzigen beiden Dateien, die Sie zum
Start benötigen, sind die TypeScript-Datei app.ts und die TypeScript-Konfiguration tsconfig.json.

Unser Ziel ist es, die folgenden Dateien in unserem Projektordner zu haben:

```
.
├── app.ts
├── node_modules
├── package-lock.json
└── tsconfig.json
```

Wir richten eine einfache tsconfig-Datei ein und aktivieren Deepkits Type-Compiler, indem wir `reflection` auf `true` setzen.
Dies ist erforderlich, um den Dependency-Injection-Container und andere Funktionen zu nutzen.

```json title=tsconfig.json
{
  "compilerOptions": {
    "outDir": "./dist",
    "experimentalDecorators": true,
    "strict": true,
    "esModuleInterop": true,
    "target": "es2020",
    "module": "CommonJS",
    "moduleResolution": "node"
  },
  "reflection": true,
  "files": [
    "app.ts"
  ]
}
```

```typescript title=app.ts
import { App } from '@deepkit/app';
import { Logger } from '@deepkit/logger';

const app = new App();

app.command('test', (logger: Logger) => {
    logger.log('Hello World!');
});

app.run();
```

In diesem Code sehen Sie, dass wir einen Testbefehl definiert und eine neue App erstellt haben, die wir direkt mit `run()` ausführen. Durch Ausführen dieses Skripts starten wir die App.

und führen sie dann direkt aus.

```sh
$ ./node_modules/.bin/ts-node app.ts
VERSION
  Node

USAGE
  $ ts-node app.ts [COMMAND]

TOPICS
  debug
  migration  Executes pending migration files. Use migration:pending to see which are pending.
  server     Starts the HTTP server

COMMANDS
  test
```

Um nun unseren Testbefehl auszuführen, führen wir den folgenden Befehl aus.

```sh
$ ./node_modules/.bin/ts-node app.ts test
Hello World
```

In Deepkit läuft nun alles über diese `app.ts`. Sie können die Datei nach Belieben umbenennen oder weitere erstellen. Benutzerdefinierte CLI-Befehle, HTTP/RPC-Server, Migrationsbefehle und so weiter werden alle
von diesem Einstiegspunkt aus gestartet.

## Argumente & Flags

Deepkit App konvertiert Funktionsparameter automatisch in CLI-Argumente und Flags. Die Reihenfolge der Parameter bestimmt die Reihenfolge der CLI-Argumente

Parameter können beliebige TypeScript-Typen sein und werden automatisch validiert und deserialisiert.

Siehe das Kapitel [Argumente & Flags](./app/arguments.md) für weitere Informationen.

## Dependency Injection

Deepkit App richtet einen Service-Container ein und für jedes importierte Modul einen eigenen Dependency-Injection-Container, der von seinen Eltern erbt.
Es stellt standardmäßig die folgenden Provider bereit, die Sie automatisch in Ihre Services, Controller und Event-Listener injizieren können:

- `Logger` für Logging
- `EventDispatcher` für Ereignisbehandlung
- `CliControllerRegistry` für registrierte CLI-Befehle
- `MiddlewareRegistry` für registrierte Middleware
- `InjectorContext` für den aktuellen Injector-Kontext

Sobald Sie Deepkit Framework importieren, erhalten Sie zusätzliche Provider. Siehe [Deepkit Framework](./framework.md) für weitere Details.

## Exit-Code

Der Exit-Code ist standardmäßig 0, was bedeutet, dass der Befehl erfolgreich ausgeführt wurde. Um den Exit-Code zu ändern, sollte eine Zahl ungleich 0 in der Execute-Methode oder dem Befehls-Callback zurückgegeben werden.

```typescript

@cli.controller('test')
export class TestCommand {
    async execute() {
        console.error('Error :(');
        return 12;
    }
}
```
