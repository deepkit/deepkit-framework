# 内存文件系统

对于内存文件系统，文件系统存储在内存中。这意味着该文件系统不是持久的，并且在应用程序退出时会丢失。
这对于测试用途尤其有用。

它是 `@deepkit/filesystem` 的一部分，因此无需额外安装。

## 用法

```typescript
import { FilesystemMemoryAdapter, Filesystem } from '@deepkit/filesystem';

const adapter = new FilesystemMemoryAdapter();
const filesystem = new Filesystem(adapter);
```