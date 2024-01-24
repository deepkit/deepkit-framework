# App

Although Deepkit Storage works standalone, you probably want to use it in your Deepkit App using Dependency Injection.

```typescript
import { App } from '@deepkit/app';
import { Filesystem, FilesystemLocalAdapter, provideFilesystem } from '@deepkit/filesystem';

const app = new App({
  providers: [provideFilesystem(new FilesystemLocalAdapter({ root: __dirname + '/public' }))],
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

You can use multiple filesystems at the same time. To do so you register them with `provideNamedFilesystem('name', ...)` and receive the Filesystem instance with
`NamedFilesystem<'name'>`.

```typescript
import { App } from '@deepkit/app';
import { FilesystemLocalAdapter, NamedFilesystem, provideNamedFilesystem } from '@deepkit/filesystem';

type PrivateFilesystem = NamedFilesystem<'private'>;
type PublicFilesystem = NamedFilesystem<'public'>;

const app = new App({
  providers: [
    provideNamedFilesystem('private', new FilesystemLocalAdapter({ root: '/tmp/dir1' })),
    provideNamedFilesystem('public', new FilesystemLocalAdapter({ root: '/tmp/dir2' })),
  ],
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

## Configuration

It's often useful to configure an adapter via configuration options. For example, you might want to configure the root directory of the local adapter
or credentials for the AWS S3 or Google Storage adapter.

To do so, you can use [Configuration Injection](../app/configuration.md).

```typescript
import { App } from '@deepkit/app';
import { Filesystem, FilesystemLocalAdapter, provideFilesystem } from '@deepkit/filesystem';

class MyConfig {
  fsRoot: string = '/tmp';
}

const app = new App({
  config: MyConfig,
  providers: [provideFilesystem((config: MyConfig) => new FilesystemLocalAdapter({ root: config.fsRoot }))],
});

app.loadConfigFromEnv({ prefix: 'APP_' });
app.run();
```
