# FTP ファイルシステム

このアダプタを使用すると、FTP サーバーをファイルシステムとして利用できます。

これは `@deepkit/filesystem-ftp` の一部であり、別途インストールする必要があります。

```sh
npm install @deepkit/filesystem-ftp
```

## 使用方法

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

注意: 認証情報をコードに直接保存すべきではありません。代わりに、環境変数や[アプリ設定](./app.md#configuration)を使用してください。

## パーミッション

FTP サーバーが Unix 環境で動作している場合、[ローカルファイルシステムアダプタ](./local.md) と同様に、`permissions` オプションを使用してファイルやフォルダのパーミッションを設定できます。

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

ここでは、ファイル `/hello-public.txt` はパーミッション `0o644` で、`/hello-private.txt` は `0o600` で作成されます。