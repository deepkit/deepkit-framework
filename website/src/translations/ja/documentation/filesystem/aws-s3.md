# AWS S3 ファイルシステム

AWS S3 ファイルシステムアダプターを使用すると、AWS S3 サービスを Deepkit Filesystem として使用できます。

これは `@deepkit/filesystem-aws-s3` の一部で、別途インストールが必要です。

```sh
npm install @deepkit/filesystem-aws-s3
```

## 使用方法

```typescript
import { Filesystem } from '@deepkit/filesystem';
import { FilesystemAwsS3Adapter } from '@deepkit/filesystem-aws-s3';

const adapter = new FilesystemAwsS3Adapter({
    bucket: 'my-bucket',
    path: 'starting-path/', // 省略可
    region: 'eu-central-1',
    acccessKeyId: '...',
    secretAccessKey: '...'
});
const filesystem = new Filesystem(adapter);
```

注意: 資格情報をコード内に直接保存しないでください。代わりに、環境変数または[アプリ構成](./app.md#configuration)を使用してください。

このアダプターは [@aws-sdk/client-s3](https://npmjs.com/package/@aws-sdk/client-s3) の S3 クライアントを使用します。
そのすべての設定オプションをアダプターのコンストラクターに渡せます。

## 権限

ファイル作成時の可視性を構成できます。

```typescript
const filesystem = new Filesystem(adapter);

filesystem.write('/hello-public.txt', 'hello world', 'public');
filesystem.write('/hello-private.txt', 'hello world', 'private');
```

ファイル `/hello-public.txt` は ACL `public-read` で作成され、その URL を使用して誰でも読み取り可能です。URL は `filesystem.publicUrl` を使用して取得できます。

```typescript
const url = filesystem.publicUrl('/hello-public.txt');
// https://my-bucket.s3.eu-central-1.amazonaws.com/starting-path/hello-public.txt
```

この可視性を使用するには、S3 バケットでオブジェクトベースの ACL を有効にする必要があります。