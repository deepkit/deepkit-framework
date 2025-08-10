# sFTP (SSH) ファイルシステム

このアダプタにより、sFTP (SSH) サーバーをファイルシステムとして使用できます。

これは `@deepkit/filesystem-sftp` の一部であり、別途インストールする必要があります。

```sh
npm install @deepkit/filesystem-sftp
```

## 使用方法

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

注意: 認証情報をコード内に直接保存するべきではありません。代わりに、環境変数または[アプリケーション設定](./app.md#configuration)を使用してください。

このアダプタは [ssh2-sftp-client](https://npmjs.com/package/ssh2-sftp-client) の sFTP クライアントを使用します。そのすべての設定オプションをアダプタのコンストラクタに渡すことができます。

## 権限

FTP サーバーが Unix 環境で実行されている場合、[ローカルファイルシステムアダプタ](./local.md) と同様に、`permissions` オプションを使用してファイルとフォルダーの権限を設定できます。

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

ここでは、ファイル `/hello-public.txt` は権限 `0o644` で、`/hello-private.txt` は `0o600` で作成されます。