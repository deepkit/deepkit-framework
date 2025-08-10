# Bereitstellung

In diesem Kapitel lernen Sie, wie Sie Ihre Anwendung nach JavaScript kompilieren, für Ihre Produktionsumgebung konfigurieren und mit Docker bereitstellen.

## TypeScript kompilieren

Angenommen, Sie haben eine Anwendung wie diese in einer `app.ts`-Datei:

```typescript
#!/usr/bin/env ts-node-script
import { App } from '@deepkit/app';
import { FrameworkModule } from '@deepkit/framework';
import { http } from '@deepkit/http';

class Config {
    title: string = 'DEV my Page';
}

class MyWebsite {
    constructor(protected title: Config['title']) {
    }

    @http.GET()
    helloWorld() {
        return 'Hello from ' + this.title;
    }
}

new App({
    config: Config,
    controllers: [MyWebsite],
    imports: [new FrameworkModule]
})
    .loadConfigFromEnv()
    .run();
```

Wenn Sie `ts-node app.ts server:start` verwenden, sehen Sie, dass alles korrekt funktioniert. In einer Produktionsumgebung würden Sie den Server normalerweise nicht mit `ts-node` starten. Sie würden ihn nach JavaScript kompilieren und dann mit Node ausführen. Dazu benötigen Sie eine korrekte `tsconfig.json` mit den passenden Konfigurationsoptionen. Im Abschnitt „Erste Anwendung“ ist Ihre `tsconfig.json` so konfiguriert, dass JavaScript in den Ordner `.dist` ausgegeben wird. Wir gehen davon aus, dass Sie es ebenfalls so konfiguriert haben.

Wenn alle Compiler-Einstellungen korrekt sind und Ihr `outDir` auf einen Ordner wie `dist` zeigt, werden, sobald Sie den Befehl `tsc` in Ihrem Projekt ausführen, alle in der `tsconfig.json` verlinkten Dateien nach JavaScript kompiliert. Es reicht aus, Ihre Entry-Dateien in dieser Liste anzugeben. Alle importierten Dateien werden ebenfalls automatisch kompiliert und müssen nicht explizit zur `tsconfig.json` hinzugefügt werden. `tsc` ist Teil von TypeScript, wenn Sie `npm install typescript` installieren.

```sh
$ ./node_modules/.bin/tsc
```

Der TypeScript-Compiler gibt nichts aus, wenn er erfolgreich war. Sie können jetzt die Ausgabe in `dist` überprüfen.

```sh
$ tree dist
dist
└── app.js
```

Sie sehen, dass es nur eine Datei gibt. Sie können sie über `node distapp.js` ausführen und erhalten dieselbe Funktionalität wie mit `ts-node app.ts`.

Für ein Deployment ist es wichtig, dass die TypeScript-Dateien korrekt kompiliert werden und alles direkt über Node funktioniert. Sie könnten nun einfach Ihren `dist`-Ordner inklusive Ihrer `node_modules` verschieben und `node distapp.js server:start` ausführen, und Ihre App ist erfolgreich bereitgestellt. Allerdings würden Sie andere Lösungen wie Docker verwenden, um Ihre App korrekt zu paketieren.

## Konfiguration

In einer Produktionsumgebung würden Sie den Server nicht an `localhost` binden, sondern höchstwahrscheinlich an alle Geräte über `0.0.0.0`. Wenn Sie nicht hinter einem Reverse Proxy sind, würden Sie auch den Port auf 80 setzen. Um diese beiden Einstellungen zu konfigurieren, müssen Sie das `FrameworkModule` anpassen. Die beiden Optionen, die uns interessieren, sind `host` und `port`. Damit diese extern über Umgebungsvariablen oder über .dotenv-Dateien konfiguriert werden können, müssen wir dies zunächst erlauben. Glücklicherweise hat unser obiger Code dies bereits mit der Methode `loadConfigFromEnv()` erledigt.

Weitere Informationen darüber, wie Sie die Anwendungs-Konfigurationsoptionen setzen, finden Sie im Kapitel [Konfiguration](../app/configuration.md).

Um zu sehen, welche Konfigurationsoptionen verfügbar sind und welchen Wert sie haben, können Sie den Befehl `ts-node app.ts app:config` verwenden. Sie können sie auch im Framework Debugger sehen.

### SSL

Es wird empfohlen (und manchmal verlangt), Ihre Anwendung über HTTPS mit SSL zu betreiben. Es gibt mehrere Optionen zur Konfiguration von SSL. Um SSL zu aktivieren, verwenden Sie
`framework.ssl` und konfigurieren seine Parameter mit den folgenden Optionen.

|===
|Name|Typ|Beschreibung

|framework.ssl|boolean|Aktiviert den HTTPS-Server, wenn true
|framework.httpsPort|number?|Wenn httpsPort und ssl definiert sind, wird der HTTPS-Server zusätzlich zum HTTP-Server gestartet.
|framework.sslKey|string?|Ein Dateipfad zu einer SSL-Key-Datei für HTTPS
|framework.sslCertificate|string?|Ein Dateipfad zu einer Zertifikatsdatei für HTTPS
|framework.sslCa|string?|Ein Dateipfad zu einer CA-Datei für HTTPS
|framework.sslCrl|string?|Ein Dateipfad zu einer CRL-Datei für HTTPS
|framework.sslOptions|object?|Gleiches Interface wie tls.SecureContextOptions & tls.TlsOptions.
|===

```typescript
import { App } from '@deepkit/app';
import { FrameworkModule } from '@deepkit/framework';

// deine Config und HTTP-Controller hier

new App({
    config: Config,
    controllers: [MyWebsite],
    imports: [
        new FrameworkModule({
            ssl: true,
            selfSigned: true,
            sslKey: __dirname + 'path/ssl.key',
            sslCertificate: __dirname + 'path/ssl.cert',
            sslCA: __dirname + 'path/ssl.ca',
        })
    ]
})
    .run();
```

### Lokales SSL

In der lokalen Entwicklungsumgebung können Sie selbstsigniertes HTTPS mit der Option `framework.selfSigned` aktivieren.

```typescript
import { App } from '@deepkit/app';
import { FrameworkModule } from '@deepkit/framework';

// deine Config und HTTP-Controller hier

new App({
    config: config,
    controllers: [MyWebsite],
    imports: [
        new FrameworkModule({
            ssl: true,
            selfSigned: true,
        })
    ]
})
    .run();
```

```sh
$ ts-node app.ts server:start
2021-06-13T18:04:01.563Z [LOG] Start HTTP server, using 1 workers.
2021-06-13T18:04:01.598Z [LOG] Self signed certificate for localhost created at var/self-signed-localhost.cert
2021-06-13T18:04:01.598Z [LOG] Tip: If you want to open this server via chrome for localhost, use chrome://flags/#allow-insecure-localhost
2021-06-13T18:04:01.606Z [LOG] HTTP MyWebsite
2021-06-13T18:04:01.606Z [LOG]     GET / helloWorld
2021-06-13T18:04:01.606Z [LOG] HTTPS listening at https://localhost:8080/
```

Wenn Sie diesen Server jetzt starten, ist Ihr HTTP-Server als HTTPS unter `https:localhost:8080` erreichbar. In Chrome erhalten Sie nun die Fehlermeldung „NET::ERR_CERT_INVALID“, wenn Sie diese URL öffnen, da selbstsignierte Zertifikate als Sicherheitsrisiko gelten: `chrome:flagsallow-insecure-localhost`.