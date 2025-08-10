# sFTP（SSH）文件系统

此适配器允许你将 sFTP（SSH）服务器用作文件系统。

它是 `@deepkit/filesystem-sftp` 的一部分，需要单独安装。

```sh
npm install @deepkit/filesystem-sftp
```

## 用法

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

注意：你不应将凭据直接存储在代码中。相反，应使用环境变量或[应用配置](./app.md#configuration)。

此适配器使用 [ssh2-sftp-client](https://npmjs.com/package/ssh2-sftp-client) 的 sFTP 客户端。其所有配置选项都可以传递给该适配器的构造函数。

## 权限

如果 FTP 服务器运行在 Unix 环境中，你可以像[本地文件系统适配器](./local.md)那样，使用 `permissions` 选项设置文件和文件夹的权限。

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