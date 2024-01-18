# Google Storage Filesystem

This adapter allows you to use Google Storage as filesystem.

It is part of `@deepkit/filesystem-google` which needs to be installed separately.

```sh
npm install @deepkit/filesystem-google
```

## Usage

```typescript
import { Filesystem } from '@deepkit/filesystem';
import { FilesystemGoogleAdapter } from '@deepkit/filesystem-google';

const adapter = new FilesystemGoogleAdapter({
    bucket: 'my-bucket',
    path: 'starting-path/', //optional
    projectId: '...',
    keyFilename: 'path/to/service-account-key.json'
});
const filesystem = new Filesystem(adapter);
```

Note: You should not store your credentials in the code directly. Instead, use environment variables or [App Configuration](./app.md#configuration).

This adapter uses the Google Storage client of [@google-cloud/storage](https://npmjs.com/package/@google-cloud/storage).
All its configuration options can be passed to the adapter constructor.

## Permissions

You can configure what visibility a file has when it is created.

```typescript
const filesystem = new Filesystem(adapter);

filesystem.write('/hello-public.txt', 'hello world', 'public');
filesystem.write('/hello-private.txt', 'hello world', 'private');
```

The file `/hello-public.txt` will be created with the ACL `public: true` and can be read by anyone using its URL. The url can be retrieved using `filesystem.publicUrl`.

```typescript
const url = filesystem.publicUrl('/hello-public.txt');
// https://storage.googleapis.com/my-bucket/starting-path/hello-public.txt
```

To use the visibility you have to enable object-based ACL in your Google Storage bucket.
