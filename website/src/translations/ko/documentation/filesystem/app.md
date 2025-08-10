# 앱

Deepkit Storage는 단독으로도 동작하지만, 보통은 Dependency Injection을 사용하여 Deepkit App에서 이를 사용하고자 할 것입니다.

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


## 여러 Filesystem

여러 Filesystem을 동시에 사용할 수 있습니다. 이를 위해 `provideNamedFilesystem('name', ...)`로 등록하고, `NamedFilesystem<'name'>`로 Filesystem 인스턴스를 주입받습니다.

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

## 구성

구성 옵션을 통해 adapter를 설정하는 것이 유용할 때가 많습니다. 예를 들어, local adapter의 루트 디렉터리나 AWS S3 또는 Google Storage adapter의 자격 증명을 설정하고 싶을 수 있습니다.

이를 위해 [Configuration Injection](../app/configuration.md)을 사용할 수 있습니다.

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