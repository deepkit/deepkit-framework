# Google Storage ファイルシステム

このアダプターは、Google Storage をファイルシステムとして使用できるようにします。

これは `@deepkit/filesystem-google` の一部で、別途インストールが必要です。

```sh
npm install @deepkit/filesystem-google
```

## 使用方法

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

注意: 認証情報をコード内に直接保存すべきではありません。代わりに、環境変数または[アプリケーション設定](./app.md#configuration)を使用してください。

このアダプターは [@google-cloud/storage](https://npmjs.com/package/@google-cloud/storage) の Google Storage クライアントを使用します。
そのすべての設定オプションをアダプターのコンストラクターに渡せます。

## 権限

作成時のファイルの可視性を設定できます。

```typescript
const filesystem = new Filesystem(adapter);

filesystem.write('/hello-public.txt', 'hello world', 'public');
filesystem.write('/hello-private.txt', 'hello world', 'private');
```

ファイル `/hello-public.txt` は ACL `public: true` で作成され、URL を使用して誰でも読み取ることができます。URL は `filesystem.publicUrl` を使用して取得できます。

```typescript
const url = filesystem.publicUrl('/hello-public.txt');
// https://storage.googleapis.com/my-bucket/starting-path/hello-public.txt
```

可視性を利用するには、Google Storage バケットでオブジェクトベースの ACL を有効にする必要があります。