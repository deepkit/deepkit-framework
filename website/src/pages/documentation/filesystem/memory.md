# Memory Filesystem

For the memory filesystem, the filesystem is stored in memory. This means that the filesystem is not persistent and will be lost when the application is exited.
This is useful especially for testing purposes.

It is part of `@deepkit/filesystem`, so not additional installation is required.

## Usage

```typescript
import { Filesystem, FilesystemMemoryAdapter } from '@deepkit/filesystem';

const adapter = new FilesystemMemoryAdapter();
const filesystem = new Filesystem(adapter);
```
