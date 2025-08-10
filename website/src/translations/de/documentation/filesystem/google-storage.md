# Google Storage-Dateisystem

Dieser Adapter ermöglicht die Verwendung von Google Storage als Dateisystem.

Er ist Teil von `@deepkit/filesystem-google`, das separat installiert werden muss.

```sh
npm install @deepkit/filesystem-google
```

## Verwendung

```typescript
import { Filesystem } from '@deepkit/filesystem';
import { FilesystemGoogleAdapter } from '@deepkit/filesystem-google';

const adapter = new FilesystemGoogleAdapter({
    bucket: 'my-bucket',
    path: 'starting-path/', //optional
    projectId: '...',
    keyFilename: 'path/to/service-account-key.json'
});
const filesystem = new Filesystem(adapter);
```

Hinweis: Sie sollten Ihre Zugangsdaten nicht direkt im Code speichern. Verwenden Sie stattdessen Umgebungsvariablen oder [App‑Konfiguration](./app.md#configuration).

Dieser Adapter verwendet den Google‑Storage‑Client von [@google-cloud/storage](https://npmjs.com/package/@google-cloud/storage).
Alle dessen Konfigurationsoptionen können an den Adapter‑Konstruktor übergeben werden.

## Berechtigungen

Sie können konfigurieren, welche Sichtbarkeit eine Datei bei der Erstellung hat.

```typescript
const filesystem = new Filesystem(adapter);

filesystem.write('/hello-public.txt', 'hello world', 'public');
filesystem.write('/hello-private.txt', 'hello world', 'private');
```

Die Datei `/hello-public.txt` wird mit der ACL `public: true` erstellt und kann von jedem über ihre URL gelesen werden. Die URL kann mittels `filesystem.publicUrl` abgerufen werden.

```typescript
const url = filesystem.publicUrl('/hello-public.txt');
// https://storage.googleapis.com/my-bucket/starting-path/hello-public.txt
```

Um die Sichtbarkeit verwenden zu können, müssen Sie objektbasierte ACLs in Ihrem Google‑Storage‑Bucket aktivieren.