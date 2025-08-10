# FTP-Dateisystem

Dieser Adapter ermöglicht es, einen FTP-Server als Dateisystem zu verwenden.

Er ist Teil von `@deepkit/filesystem-ftp`, das separat installiert werden muss.

```sh
npm install @deepkit/filesystem-ftp
```

## Verwendung

```typescript
import { Filesystem } from '@deepkit/filesystem';
import { FilesystemFtpAdapter } from '@deepkit/filesystem-ftp';

const adapter = new FilesystemFtpAdapter({
    root: 'folder',
    host: 'localhost',
    port: 21,
    username: 'user',
    password: 'password',
});
const filesystem = new Filesystem(adapter);
```

Hinweis: Sie sollten Ihre Zugangsdaten nicht direkt im Code speichern. Verwenden Sie stattdessen Umgebungsvariablen oder [App-Konfiguration](./app.md#configuration).

## Berechtigungen

Wenn der FTP-Server in einer Unix-Umgebung läuft, können Sie die Berechtigungen der Dateien und Ordner über die Option `permissions` festlegen, genauso wie beim [lokalen Dateisystem-Adapter](./local.md).

```typescript
const adapter = new FilesystemFtpAdapter({
    // ...
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