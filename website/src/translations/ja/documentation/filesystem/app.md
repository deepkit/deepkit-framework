# アプリ

Deepkit Storage はスタンドアロンでも動作しますが、通常は依存性注入を用いて Deepkit アプリ内で使用したくなるでしょう。

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


## 複数のファイルシステム

同時に複数のファイルシステムを使用できます。このためには、`provideNamedFilesystem('name', ...)` で登録し、`NamedFilesystem<'name'>` で Filesystem インスタンスを受け取ります。

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

## 設定

設定オプションを通してアダプタを設定できると便利なことがよくあります。例えば、ローカルアダプタのルートディレクトリや、AWS S3 や Google Storage アダプタ用の認証情報を設定したい場合があります。

そのためには、[設定のインジェクション](../app/configuration.md) を使用できます。

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