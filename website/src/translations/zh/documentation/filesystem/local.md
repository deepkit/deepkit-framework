# 本地文件系统

本地文件系统适配器是最常见的文件系统之一，提供对运行该应用程序的系统中文件系统的访问。

它是 `@deepkit/filesystem` 的一部分，并在底层使用 Node 的 `fs/promises` API，因此不需要额外安装。

## 用法

```typescript
import { FilesystemLocalAdapter, Filesystem } from '@deepkit/filesystem';

const adapter = new FilesystemLocalAdapter({ root: '/path/to/files' });
const filesystem = new Filesystem(adapter);
```

这里的 `root` 选项是文件系统的根目录。所有路径都相对于该根目录。

```typescript
// 读取文件 /path/to/files/hello.txt
const content: string = await filesystem.readAsText('/hello.txt');
```

## 权限

你可以配置在创建文件和目录时文件系统应使用的权限。每个类别（文件、目录）可以分别配置为两种可见性：`public` 和 `private`。

```typescript
const adapter = new FilesystemLocalAdapter({
    root: '/path/to/files',
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

这里文件 `/hello-public.txt` 将以权限 `0o644` 创建，而 `/hello-private.txt` 为 `0o600`。