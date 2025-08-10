# sFTP (SSH) Dateisystem

Dieser Adapter ermöglicht es, einen sFTP-(SSH)-Server als Dateisystem zu verwenden.

Es ist Teil von `@deepkit/filesystem-sftp`, das separat installiert werden muss.

```sh
npm install @deepkit/filesystem-sftp
```

## Verwendung

```typescript
import { Filesystem } from '@deepkit/filesystem';
import { FilesystemSftpAdapter } from '@deepkit/filesystem-sftp';

const adapter = new FilesystemSftpAdapter({
    root: 'folder',
    host: 'localhost',
    port: 22,
    username: 'user',
    password: 'password',
});
const filesystem = new Filesystem(adapter);
```

Hinweis: Sie sollten Ihre Zugangsdaten nicht direkt im Code speichern. Verwenden Sie stattdessen Umgebungsvariablen oder [App-Konfiguration](./app.md#configuration).

Dieser Adapter verwendet den sFTP-Client von [ssh2-sftp-client](https://npmjs.com/package/ssh2-sftp-client). Alle seine Konfigurationsoptionen können an den Adapter-Konstruktor übergeben werden.

## Berechtigungen

Wenn der FTP-Server in einer Unix-Umgebung läuft, können Sie die Berechtigungen der Dateien und Ordner über die Option `permissions` festlegen, genau wie beim [lokalen Dateisystem-Adapter](./local.md).

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