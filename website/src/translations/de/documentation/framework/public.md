# Öffentliches Verzeichnis

Das `FrameworkModule` bietet eine Möglichkeit, statische Dateien wie Bilder, PDFs, Binärdateien usw. über HTTP auszuliefern. Die Konfigurationsoption `publicDir` ermöglicht es Ihnen, anzugeben, welcher Ordner als Standard-Einstiegspunkt für Anfragen verwendet wird, die nicht zu einer HTTP-Controller-Route führen. Standardmäßig ist dieses Verhalten deaktiviert (leerer Wert).

Um die Bereitstellung öffentlicher Dateien zu aktivieren, setzen Sie `publicDir` auf einen Ordner Ihrer Wahl. Üblicherweise wählt man einen Namen wie `publicDir`, um es eindeutig zu machen.

```
.
├── app.ts
└── publicDir
    └── logo.jpg
```

Um die Option `publicDir` zu ändern, können Sie das erste Argument von `FrameworkModule` ändern.

```typescript
import { App } from '@deepkit/app';
import { FrameworkModule } from '@deepkit/framework';

// Ihre Config und HTTP Controller hier

new App({
    config: config,
    controllers: [MyWebsite],
    imports: [
        new FrameworkModule({
            publicDir: 'publicDir'
        })
    ]
})
    .run();
```

Alle Dateien in diesem konfigurierten Ordner sind nun über HTTP zugänglich. Wenn Sie zum Beispiel `http:localhost:8080/logo.jpg` aufrufen, sehen Sie das Bild `logo.jpg` im Verzeichnis `publicDir`.