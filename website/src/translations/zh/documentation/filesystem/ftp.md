# FTP 文件系统

此适配器允许你将 FTP 服务器用作文件系统。

它是 `@deepkit/filesystem-ftp` 的一部分，需要单独安装。

```sh
npm install @deepkit/filesystem-ftp
```

## 用法

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

注意：不应直接在代码中存储你的凭据。请使用环境变量或[应用配置](./app.md#configuration)。

## 权限

如果 FTP 服务器运行在类 Unix 环境中，你可以像使用[本地文件系统适配器](./local.md)那样，通过 `permissions` 选项设置文件和文件夹的权限。

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

这里，文件 `/hello-public.txt` 将以权限 `0o644` 创建，而 `/hello-private.txt` 将以权限 `0o600` 创建。