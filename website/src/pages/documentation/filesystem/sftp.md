# sFTP (SSH) Filesystem

This adapter allows you to use an sFTP (SSH) server as filesystem.

It is part of `@deepkit/filesystem-sftp` which needs to be installed separately.

```sh
npm install @deepkit/filesystem-sftp
```

## Usage

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

Note: You should not store your credentials in the code directly. Instead, use environment variables or [App Configuration](./app.md#configuration).

This adapter uses the sFTP client of [ssh2-sftp-client](https://npmjs.com/package/ssh2-sftp-client). All its configuration options can be passed to the adapter constructor.

## Permissions

If the FTP server is running in a Unix environment, you can set the permissions of the files and folders using the `permissions` option just like with the [local filesystem adapter](./local.md).

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

Here the file `/hello-public.txt` will be created with the permissions `0o644` and `/hello-private.txt` with `0o600`.
