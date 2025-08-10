# AWS S3-Dateisystem

Der AWS S3 Filesystem-Adapter ermöglicht es Ihnen, den AWS S3 Service als Deepkit Filesystem zu verwenden.

Es ist Teil von `@deepkit/filesystem-aws-s3`, das separat installiert werden muss.

```sh
npm install @deepkit/filesystem-aws-s3
```

## Verwendung

```typescript
import { Filesystem } from '@deepkit/filesystem';
import { FilesystemAwsS3Adapter } from '@deepkit/filesystem-aws-s3';

const adapter = new FilesystemAwsS3Adapter({
    bucket: 'my-bucket',
    path: 'starting-path/', // optional
    region: 'eu-central-1',
    acccessKeyId: '...',
    secretAccessKey: '...'
});
const filesystem = new Filesystem(adapter);
```

Hinweis: Sie sollten Ihre Anmeldeinformationen nicht direkt im Code speichern. Verwenden Sie stattdessen Umgebungsvariablen oder [App-Konfiguration](./app.md#configuration).

Dieser Adapter verwendet den S3-Client von [@aws-sdk/client-s3](https://npmjs.com/package/@aws-sdk/client-s3). 
Alle Konfigurationsoptionen können an den Adapter-Konstruktor übergeben werden.

## Berechtigungen

Sie können konfigurieren, welche Sichtbarkeit eine Datei bei der Erstellung hat.

```typescript
const filesystem = new Filesystem(adapter);

filesystem.write('/hello-public.txt', 'hello world', 'public');
filesystem.write('/hello-private.txt', 'hello world', 'private');
```

Die Datei `/hello-public.txt` wird mit der ACL `public-read` erstellt und kann von jedem über ihre URL gelesen werden. Die URL kann über `filesystem.publicUrl` abgerufen werden.

```typescript
const url = filesystem.publicUrl('/hello-public.txt');
// https://my-bucket.s3.eu-central-1.amazonaws.com/starting-path/hello-public.txt
```

Um die Sichtbarkeit zu verwenden, müssen Sie objektbasierte ACLs in Ihrem S3-Bucket aktivieren.