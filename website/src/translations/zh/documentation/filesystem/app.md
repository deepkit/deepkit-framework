将以下文本翻译成中文： # App

虽然 Deepkit Storage 可以独立运行，但你可能希望在 Deepkit App 中通过依赖注入来使用它。

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


## 多个文件系统

你可以同时使用多个文件系统。为此，你可以用 `provideNamedFilesystem('name', ...)` 注册它们，并通过 
`NamedFilesystem<'name'>` 获取 Filesystem 实例。

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

## 配置

通常通过配置选项来配置适配器很有用。例如，你可能希望配置本地适配器的根目录，或 AWS S3 或 Google Storage 适配器的凭据。

为此，你可以使用[配置注入](../app/configuration.md)。

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