# Testen

Die Services und Controller im Deepkit-Framework sind darauf ausgelegt, SOLID und Clean Code zu unterstützen, der gut entworfen, gekapselt und getrennt ist. Diese Eigenschaften machen den Code leicht testbar.

Diese Dokumentation zeigt Ihnen, wie Sie ein Test-Framework namens [Jest](https://jestjs.io) mit `ts-jest` einrichten. Führen Sie dazu den folgenden Befehl aus, um `jest` und `ts-jest` zu installieren.

```sh
npm install jest ts-jest @types/jest
```

Jest benötigt einige Konfigurationsoptionen, um zu wissen, wo die Test-Suites zu finden sind und wie der TS-Code kompiliert wird. Fügen Sie die folgende Konfiguration zu Ihrer `package.json` hinzu:

```json title=package.json
{
  ...,

  "jest": {
    "transform": {
      "^.+\\.(ts|tsx)$": "ts-jest"
    },
    "testEnvironment": "node",
    "testMatch": [
      "**/*.spec.ts"
    ]
  }
}
```

Ihre Testdateien sollten mit `.spec.ts` benannt werden. Erstellen Sie eine Datei `test.spec.ts` mit folgendem Inhalt.

```typescript
test('first test', () => {
    expect(1 + 1).toBe(2);
});
```

Sie können nun den Befehl jest verwenden, um alle Ihre Test-Suites auf einmal auszuführen.

```sh
$ node_modules/.bin/jest
 PASS  ./test.spec.ts
  ✓ first test (1 ms)

Test Suites: 1 passed, 1 total
Tests:       1 passed, 1 total
Snapshots:   0 total
Time:        0.23 s, estimated 1 s
Ran all test suites.
```

Bitte lesen Sie die [Jest-Dokumentation](https://jestjs.io), um mehr darüber zu erfahren, wie das Jest-CLI-Tool funktioniert und wie Sie ausgefeiltere Tests und ganze Test-Suites schreiben können.

## Unit-Test

Wann immer möglich, sollten Sie Ihre Services mit Unit-Tests testen. Je einfacher, besser getrennt und besser definiert Ihre Service-Abhängigkeiten sind, desto leichter lassen sie sich testen. In diesem Fall können Sie einfache Tests wie die folgenden schreiben:

```typescript
export class MyService {
    helloWorld() {
        return 'hello world';
    }
}
```

```typescript
//
import { MyService } from './my-service.ts';

test('hello world', () => {
    const myService = new MyService();
    expect(myService.helloWorld()).toBe('hello world');
});
```

## Integrationstests

Es ist nicht immer möglich, Unit-Tests zu schreiben, und es ist auch nicht immer der effizienteste Weg, um geschäftskritischen Code und Verhalten abzudecken. Besonders wenn Ihre Architektur sehr komplex ist, ist es vorteilhaft, End-to-End-Integrationstests einfach durchführen zu können.

Wie Sie bereits im Kapitel Dependency Injection gelernt haben, ist der Dependency Injection Container das Herz von Deepkit. Hier werden alle Services erstellt und ausgeführt. Ihre Anwendung definiert Services (Providers), Controller, Listener und Imports. Für Integrationstests möchten Sie in einem Testfall nicht unbedingt alle Services verfügbar haben, sondern in der Regel eine abgespeckte Version der Anwendung, um die kritischen Bereiche zu testen.

```typescript
import { createTestingApp } from '@deepkit/framework';
import { http, HttpRequest } from '@deepkit/http';

test('http controller', async () => {
    class MyController {

        @http.GET()
        hello(@http.query() text: string) {
            return 'hello ' + text;
        }
    }

    const testing = createTestingApp({ controllers: [MyController] });
    await testing.startServer();

    const response = await testing.request(HttpRequest.GET('/').query({text: 'world'}));

    expect(response.getHeader('content-type')).toBe('text/plain; charset=utf-8');
    expect(response.body.toString()).toBe('hello world');
});
```

```typescript
import { createTestingApp } from '@deepkit/framework';

test('service', async () => {
    class MyService {
        helloWorld() {
            return 'hello world';
        }
    }

    const testing = createTestingApp({ providers: [MyService] });

    // Zugriff auf den Dependency Injection Container und MyService instanziieren
    const myService = testing.app.get(MyService);

    expect(myService.helloWorld()).toBe('hello world');
});
```

Wenn Sie Ihre Anwendung in mehrere Module aufgeteilt haben, können Sie diese leichter testen. Angenommen, Sie haben ein `AppCoreModule` erstellt und möchten einige Services testen.

```typescript
class Config {
    items: number = 10;
}

export class MyService {
    constructor(protected items: Config['items']) {

    }

    doIt(): boolean {
        //etwas tun
        return true;
    }
}

export AppCoreModule = new AppModule({}, {
    config: config,
    provides: [MyService]
}, 'core');
```

Sie verwenden Ihr Modul wie folgt:

```typescript
import { AppCoreModule } from './app-core.ts';

new App({
    imports: [new AppCoreModule]
}).run();
```

Und testen Sie es, ohne den gesamten Anwendungsserver zu starten.

```typescript
import { createTestingApp } from '@deepkit/framework';
import { AppCoreModule, MyService } from './app-core.ts';

test('service simple', async () => {
    const testing = createTestingApp({ imports: [new AppCoreModule] });

    const myService = testing.app.get(MyService);
    expect(myService.doIt()).toBe(true);
});

test('service simple big', async () => {
    // Sie ändern Konfigurationen Ihres Moduls für spezifische Testszenarien
    const testing = createTestingApp({
        imports: [new AppCoreModule({items: 100})]
    });

    const myService = testing.app.get(MyService);
    expect(myService.doIt()).toBe(true);
});
```