# AWS S3 文件系统

AWS S3 文件系统适配器允许你将 AWS S3 服务用作 Deepkit 文件系统。

它属于需要单独安装的 `@deepkit/filesystem-aws-s3`。

```sh
npm install @deepkit/filesystem-aws-s3
```

## 用法

```typescript
import { Filesystem } from '@deepkit/filesystem';
import { FilesystemAwsS3Adapter } from '@deepkit/filesystem-aws-s3';

const adapter = new FilesystemAwsS3Adapter({
    bucket: 'my-bucket',
    path: 'starting-path/', // 可选
    region: 'eu-central-1',
    acccessKeyId: '...',
    secretAccessKey: '...'
});
const filesystem = new Filesystem(adapter);
```

注意：不应直接在代码中存储凭据。请使用环境变量或[应用配置](./app.md#configuration)。

该适配器使用 [@aws-sdk/client-s3](https://npmjs.com/package/@aws-sdk/client-s3) 的 S3 客户端。
其所有配置选项都可以传递给适配器构造函数。

## 权限

你可以配置文件在创建时的可见性。

```typescript
const filesystem = new Filesystem(adapter);

filesystem.write('/hello-public.txt', 'hello world', 'public');
filesystem.write('/hello-private.txt', 'hello world', 'private');
```

文件 `/hello-public.txt` 将使用 ACL `public-read` 创建，并且任何人都可以通过其 URL 读取。可以使用 `filesystem.publicUrl` 获取该 URL。

```typescript
const url = filesystem.publicUrl('/hello-public.txt');
// https://my-bucket.s3.eu-central-1.amazonaws.com/starting-path/hello-public.txt
```

要使用可见性功能，你必须在 S3 存储桶中启用基于对象的 ACL。