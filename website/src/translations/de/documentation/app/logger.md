# Logger

Deepkit Logger ist eine eigenständige Bibliothek mit einer primären Logger Class, die du zum Protokollieren verwenden kannst. Diese Class ist im Dependency Injection-Container deiner Deepkit-Anwendung automatisch verfügbar.

Die `Logger` Class hat mehrere Methods, die sich jeweils wie `console.log` verhalten.

| Name            | Log Level           | Level-ID |
|-----------------|---------------------|----------|
| logger.error()  | Error               | 1        |
| logger.warning()| Warning             | 2        |
| logger.log()    | Standard-Log        | 3        |
| logger.info()   | Spezielle Informationen | 4    |
| logger.debug()  | Debug-Informationen | 5        |


Standardmäßig hat ein Logger Level `info`, d. h. er verarbeitet nur info-Nachrichten und höher (d. h. log, warning, error, aber nicht debug). Um das Log Level zu ändern, rufe z. B. `logger.level = 5` auf.

## Verwendung in der Anwendung

Um den Logger in deiner Deepkit-Anwendung zu verwenden, kannst du `Logger` einfach in deine Services oder Controller injecten.

```typescript
import { Logger } from '@deepkit/logger';
import { App } from '@deepkit/app';

const app = new App();
app.command('test', (logger: Logger) => {
    logger.log('This is a <yellow>log message</yellow>');
});

app.run();
```

## Farben

Der Logger unterstützt farbige Log-Nachrichten. Du kannst Farben bereitstellen, indem du XML-Tags verwendest, die den Text umschließen, der farbig erscheinen soll.

```typescript
const username = 'Peter';
logger.log(`Hi <green>${username}</green>`);
```

Für Transporter, die keine Farben unterstützen, wird die Farbinformation automatisch entfernt. Im Standard-Transporter (`ConsoleTransport`) wird die Farbe angezeigt. Folgende Farben sind verfügbar: `black`, `red`, `green`, `blue`, `cyan`, `magenta`, `white` und `grey`/`gray`.

## Transporter

Du kannst einen einzelnen Transporter oder mehrere Transporter konfigurieren. In einer Deepkit-Anwendung ist der `ConsoleTransport`-Transporter automatisch konfiguriert. Um zusätzliche Transporter zu konfigurieren, kannst du [Setup-Aufrufe](dependency-injection.md#di-setup-calls) verwenden:

```typescript
import { Logger, LoggerTransport } from '@deepkit/logger';

export class MyTransport implements LoggerTransport {
    write(message: string, level: LoggerLevel, rawMessage: string) {
        process.stdout.write(JSON.stringify({message: rawMessage, level, time: new Date}) + '\n');
    }

    supportsColor() {
        return false;
    }
}

new App()
    .setup((module, config) => {
        module.configureProvider<Logger>(v => v.addTransport(new MyTransport));
    })
    .run();
```

Um alle Transporter durch einen neuen Satz von Transportern zu ersetzen, verwende `setTransport`:

```typescript
import { Logger } from '@deepkit/logger';

new App()
.setup((module, config) => {
    module.configureProvider<Logger>(v => v.setTransport([new MyTransport]));
})
.run();
```

```typescript
import { Logger, JSONTransport } from '@deepkit/logger';

new App()
    .setup((module, config) => {
        module.configureProvider<Logger>(v => v.setTransport([new JSONTransport]));
    })
    .run();
```

## Scoped Logger

Scoped Logger fügen jedem Log-Eintrag einen beliebigen Bereichsnamen hinzu, was dabei helfen kann festzustellen, aus welchem Teilbereich deiner Anwendung der Log-Eintrag stammt.

```typescript
const scopedLogger = logger.scoped('database');
scopedLogger.log('Query', query);
```

Es gibt auch einen `ScopedLogger` Type, den du verwenden kannst, um Scoped Logger in deine Services zu injecten.

```typescript
import { ScopedLogger } from '@deepkit/logger';

class MyService {
    constructor(protected logger: ScopedLogger) {}
    doSomething() {
        this.logger.log('This is wild');
    }
}
```

Alle Nachrichten eines Scoped Loggers werden nun mit dem Scope-Namen `MyService` vorangestellt.

## Formatter

Mit Formattern kannst du das Nachrichtenformat ändern, z. B. den Zeitstempel hinzufügen. Wenn eine Anwendung über `server:start` gestartet wird, wird automatisch ein `DefaultFormatter` hinzugefügt (der Zeitstempel, Bereich und Log Level hinzufügt), wenn kein anderer Formatter verfügbar ist.

## Kontextdaten

Um Kontextdaten zu einem Log-Eintrag hinzuzufügen, füge als letztes Argument ein einfaches Objektliteral hinzu. Nur Log-Aufrufe mit mindestens zwei Argumenten können Kontextdaten enthalten.

```typescript
const query = 'SELECT *';
const user = new User;
logger.log('Query', {query, user}); //letztes Argument sind Kontextdaten
logger.log('Another', 'wild log entry', query, {user}); //letztes Argument sind Kontextdaten

logger.log({query, user}); //dies wird nicht als Kontextdaten behandelt.
```