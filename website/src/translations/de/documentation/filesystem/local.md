# Lokales Dateisystem

Der lokale Dateisystem-Adapter ist eine der am häufigsten verwendeten Optionen und bietet Zugriff auf das Dateisystem, auf dem die Anwendung läuft.

Er ist Teil von `@deepkit/filesystem` und verwendet die `fs/promises`-API von Node unter der Haube, sodass keine zusätzliche Installation erforderlich ist.

## Verwendung

```typescript
import { FilesystemLocalAdapter, Filesystem } from '@deepkit/filesystem';

const adapter = new FilesystemLocalAdapter({ root: '/path/to/files' });
const filesystem = new Filesystem(adapter);
```

Hier gibt die Option `root` das Wurzelverzeichnis des Dateisystems an. Alle Pfade sind relativ zu diesem Wurzelverzeichnis.

```typescript
// liest die Datei /path/to/files/hello.txt
const content: string = await filesystem.readAsText('/hello.txt');
```

## Berechtigungen

Sie können konfigurieren, welche Berechtigungen das Dateisystem beim Erstellen von Dateien und Verzeichnissen verwenden soll. Jede Kategorie (file, directory) kann separat in zwei Sichtbarkeiten konfiguriert werden: `public` und `private`.

```typescript
const adapter = new FilesystemLocalAdapter({
    root: '/path/to/files',
    permissions: {
        file: {
            public: 0o644,
            private: 0o600,
        },
        directory: {
            public: 0o755,
            private: 0o700,
        }
    }
});


const filesystem = new Filesystem(adapter);

filesystem.write('/hello-public.txt', 'hello world', 'public');
filesystem.write('/hello-private.txt', 'hello world', 'private');
```

Hier wird die Datei `/hello-public.txt` mit den Berechtigungen `0o644` und `/hello-private.txt` mit `0o600` erstellt.