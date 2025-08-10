# Google 存储文件系统

此适配器允许你将 Google 存储用作文件系统。

它是 `@deepkit/filesystem-google` 的一部分，需要单独安装。

```sh
npm install @deepkit/filesystem-google
```

## 用法

```typescript
import { Filesystem } from '@deepkit/filesystem';
import { FilesystemGoogleAdapter } from '@deepkit/filesystem-google';

const adapter = new FilesystemGoogleAdapter({
    bucket: 'my-bucket',
    path: 'starting-path/', // 可选
    projectId: '...',
    keyFilename: 'path/to/service-account-key.json'
});
const filesystem = new Filesystem(adapter);
```

注意：你不应直接在代码中存储凭据。相反，请使用环境变量或[应用配置](./app.md#configuration)。

该适配器使用 [@google-cloud/storage](https://npmjs.com/package/@google-cloud/storage) 的 Google 存储客户端。
其所有配置选项都可以传递给适配器构造函数。

## 权限

你可以配置文件在创建时的可见性。

```typescript
const filesystem = new Filesystem(adapter);

filesystem.write('/hello-public.txt', 'hello world', 'public');
filesystem.write('/hello-private.txt', 'hello world', 'private');
```

文件 `/hello-public.txt` 将以 ACL `public: true` 创建，任何人都可以通过其 URL 读取。可以使用 `filesystem.publicUrl` 获取该 URL。

```typescript
const url = filesystem.publicUrl('/hello-public.txt');
// https://storage.googleapis.com/my-bucket/starting-path/hello-public.txt
```

要使用可见性功能，你必须在 Google 存储的存储桶中启用基于对象的 ACL。