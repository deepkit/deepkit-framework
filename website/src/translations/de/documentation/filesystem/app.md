# App

Obwohl Deepkit Storage eigenständig funktioniert, möchtest du es wahrscheinlich in deiner Deepkit App mit Dependency Injection verwenden.

```typescript
import { App } from '@deepkit/app';
import { Filesystem, FilesystemLocalAdapter, provideFilesystem } from '@deepkit/filesystem';

const app = new App({
    providers: [
        provideFilesystem(new FilesystemLocalAdapter({root: __dirname + '/public'})),
    ]
});

app.command('write', async (content: string, fs: Filesystem) => {
    await fs.write('/hello.txt', content);
});

app.command('read', async (fs: Filesystem) => {
    const content = await fs.readAsText('/hello.txt');
    console.log(content);
});

app.run();
```


## Multiple Filesystems

Du kannst mehrere Filesystems gleichzeitig verwenden. Dazu registrierst du sie mit `provideNamedFilesystem('name', ...)` und erhältst die Filesystem-Instanz mit 
`NamedFilesystem<'name'>`.

```typescript
import { App } from '@deepkit/app';
import { NamedFilesystem, FilesystemLocalAdapter, provideNamedFilesystem } from '@deepkit/filesystem';

type PrivateFilesystem = NamedFilesystem<'private'>;
type PublicFilesystem = NamedFilesystem<'public'>;

const app = new App({
    providers: [
        provideNamedFilesystem('private', new FilesystemLocalAdapter({root: '/tmp/dir1'})),
        provideNamedFilesystem('public', new FilesystemLocalAdapter({root: '/tmp/dir2'})),
    ]
});

app.command('write', async (content: string, fs: PublicFilesystem) => {
    await fs.write('/hello.txt', content);
});

app.command('read', async (fs: PublicFilesystem) => {
    const content = await fs.readAsText('/hello.txt');
    console.log(content);
});

app.run();
```

## Konfiguration

Es ist oft sinnvoll, einen Adapter über Konfigurationsoptionen zu konfigurieren. Zum Beispiel möchtest du vielleicht das Root-Verzeichnis des lokalen Adapters konfigurieren
oder Zugangsdaten für den AWS S3- oder Google-Storage-Adapter.

Dazu kannst du [Configuration Injection](../app/configuration.md) verwenden.

```typescript
import { App } from '@deepkit/app';
import { Filesystem, FilesystemLocalAdapter, provideFilesystem } from '@deepkit/filesystem';

class MyConfig {
    fsRoot: string = '/tmp';
}

const app = new App({
    config: MyConfig,
    providers: [
        provideFilesystem(
            (config: MyConfig) => new FilesystemLocalAdapter({root: config.fsRoot})
        ),
    ]
});

app.loadConfigFromEnv({prefix: 'APP_'})
app.run();
```