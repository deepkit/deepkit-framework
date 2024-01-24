# AWS S3 Filesystem

The AWS S3 filesystem adapter allows you to use the AWS S3 service as Deepkit Filesystem.

It is part of `@deepkit/filesystem-aws-s3` which needs to be installed separately.

```sh
npm install @deepkit/filesystem-aws-s3
```

## Usage

```typescript
import { Filesystem } from '@deepkit/filesystem';
import { FilesystemAwsS3Adapter } from '@deepkit/filesystem-aws-s3';

const adapter = new FilesystemAwsS3Adapter({
  bucket: 'my-bucket',
  path: 'starting-path/', //optional
  region: 'eu-central-1',
  acccessKeyId: '...',
  secretAccessKey: '...',
});
const filesystem = new Filesystem(adapter);
```

Note: You should not store your credentials in the code directly. Instead, use environment variables or [App Configuration](./app.md#configuration).

This adapter uses the S3 client of [@aws-sdk/client-s3](https://npmjs.com/package/@aws-sdk/client-s3).
All its configuration options can be passed to the adapter constructor.

## Permissions

You can configure what visibility a file has when it is created.

```typescript
const filesystem = new Filesystem(adapter);

filesystem.write('/hello-public.txt', 'hello world', 'public');
filesystem.write('/hello-private.txt', 'hello world', 'private');
```

The file `/hello-public.txt` will be created with the ACL `public-read` and can be read by anyone using its URL. The url can be retrieved using `filesystem.publicUrl`.

```typescript
const url = filesystem.publicUrl('/hello-public.txt');
// https://my-bucket.s3.eu-central-1.amazonaws.com/starting-path/hello-public.txt
```

To use the visibility you have to enable object-based ACL in your S3 bucket.
