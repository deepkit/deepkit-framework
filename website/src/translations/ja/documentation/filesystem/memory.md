# メモリファイルシステム

メモリファイルシステムでは、ファイルシステムはメモリ上に保存されます。これは、ファイルシステムが永続化されず、アプリケーションを終了すると失われることを意味します。
特にテスト用途に有用です。

これは `@deepkit/filesystem` の一部であり、追加のインストールは不要です。

## 使い方

```typescript
import { FilesystemMemoryAdapter, Filesystem } from '@deepkit/filesystem';

const adapter = new FilesystemMemoryAdapter();
const filesystem = new Filesystem(adapter);
```