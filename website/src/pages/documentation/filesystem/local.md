# Local Filesystem

The local filesystem adapter is one of the most common filesystems and provides access to the filesystem on which the application is running.

It is part of `@deepkit/filesystem` and uses the `fs/promises` API of Node under the hood, so not additional installation is required.

## Usage

```typescript
import { FilesystemLocalAdapter, Filesystem } from '@deepkit/filesystem';

const adapter = new FilesystemLocalAdapter({ root: '/path/to/files' });
const filesystem = new Filesystem(adapter);
```

Here the `root` option is the root directory of the filesystem. All paths are relative to this root.

```typescript
// reads the file /path/to/files/hello.txt
const content: string = await filesystem.readAsText('/hello.txt');
```

## Permissions

You can configure what permissions the filesystem should use when creating files and directories. Each category (file, directory) can be configured separately into two visibilities: `public` and `private`.

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

Here the file `/hello-public.txt` will be created with the permissions `0o644` and `/hello-private.txt` with `0o600`.
