# Deepkit Filesystem

Deepkit Filesystem is a filesystem abstraction for local and remote filesystems. It allows you to work with files and directories in a unified way, no matter if the files are stored locally or on a remote server.

Supported filesystems out of the box:

- Local filesystem (packaged in `@deepkit/filesystem`)
- Memory (packaged in `@deepkit/filesystem`)
- FTP (packaged in `@deepkit/filesystem-ftp`)
- SFTP (packaged in `@deepkit/filesystem-sftp`)
- AWS S3 (packaged in `@deepkit/filesystem-aws-s3`)
- Google Cloud Filesystem (packaged in `@deepkit/filesystem-google`)

## Installation

```bash
npm install @deepkit/filesystem
```

Note: If you don't use NPM, make sure peer dependencies are installed correctly.

## Usage

```typescript
import { Filesystem, FilesystemLocalAdapter } from '@deepkit/filesystem';

const adapter = new FilesystemLocalAdapter('/path/to/my/files');
const filesystem = new Filesystem(adapter);

const files = await filesystem.files();
for (const file of files) {
  console.log(file.path);
}

await filesystem.write('myFile.txt', 'Hello World');
const file = await filesystem.get('myFile.txt');
console.log(file.path, file.size, file.lastModified);

const content = await filesystem.read('myFile.txt');
```

## List Files

To list files use the `files()` method. It returns an array of `File` objects.

```typescript
const files = await filesystem.files();
for (const file of files) {
  console.log(file.path);
}
```

If the array is empty, either the folder doesn't exist or no files in there.

To list all files recursively use the `allFiles()` method.

```typescript
const files = await filesystem.allFiles();
for (const file of files) {
  console.log(file.path);
}
```

## Read File

To read a file use the `read()` method. It returns the file content as `Uint8Array`.

```typescript
const content = await filesystem.read('myFile.txt');
```

To read it as a text use the `readAsText()` method. It returns a string.

```typescript
const content = await filesystem.readAsText('myFile.txt');
```

## Write File

To write a file use the `write()` method. It accepts a `Uint8Array` or a string.

```typescript
await filesystem.write('myFile.txt', 'Hello World');
```

To write from a local file use the `writeFile()` method.

Note that the first argument is the directory, not the file name. The file name is the basename of the provided file.
You can change the file name by passing a {name: 'myFile.txt'} object as second argument. If no file extension is provided,
the extension is automatically detected.

```typescript
const path = await filesystem.writeFile('/', { path: '/path/to/local/file.txt' });

// works with UploadedFile
router.post('/upload', async (body: HttpBody<{ file: UploadedFile }>, filesystem: Filesystem, session: Session) => {
  const user = session.getUser();
  const path = await filesystem.writeFile('/user-images', body.file, { name: `user-${user.id}` });
  //path = /user-images/user-123.jpg
});
```

## Delete File

To delete a file use the `delete()` method.

```typescript
await filesystem.delete('myFile.txt');
```

This deletes the file `myFile.txt` in the root folder. If the path is a directory, it throws an error.

## Delete Directory

To delete a directory use the `deleteDirectory()` method. This deletes the directory and all files and directories inside.

```typescript
await filesystem.deleteDirectory('myFolder');
```

## Create Directory

To create a directory use the `createDirectory()` method.

```typescript
await filesystem.makeDirectory('myFolder');
```

## Move File

To move a file or directory use the `move()` method. It accepts a `File` object or a path.

```typescript
await filesystem.move('myFile.txt', 'myFolder/myFile.txt');
```

It creates the directory `myFolder` if it doesn't exist.

## Copy File

To copy a file or directory use the `copy()` method. It accepts a `File` object or a path.

```typescript
await filesystem.copy('myFile.txt', 'myFolder/myFile.txt');
```

It creates the directory `myFolder` if it doesn't exist.

## File Information

To get information about a file use the `get()` method. It returns a `File` object.

```typescript
const file: FilesystemFile = await filesystem.get('myFile.txt');
console.log(file.path, file.size, file.lastModified);
```

It returns the path, the file size in bytes, and the last modified date. Modified date might be undefined if the adapter doesn't support it.

The File object also has some handy methods:

```typescript
interface FilesystemFile {
  path: string;
  type: FileType; //file or directory
  size: number;
  lastModified?: Date;
  /**
   * Visibility of the file.
   *
   * Note that some adapters might not support reading the visibility of a file.
   * In this case, the visibility is always 'private'.
   *
   * Some adapters might support reading the visibility per file, but not when listing files.
   * In this case you have to call additional `filesystem.get(file)` to load the visibility.
   */
  visibility: FileVisibility; //public or private
  constructor(path: string, type?: FileType);
  /**
   * Returns true if this file is a symbolic link.
   */
  isFile(): boolean;
  /**
   * Returns true if this file is a directory.
   */
  isDirectory(): boolean;
  /**
   * Returns the name (basename) of the file.
   */
  get name(): string;
  /**
   * Returns true if this file is in the given directory.
   */
  inDirectory(directory: string): boolean;
  /**
   * Returns the directory (dirname) of the file.
   */
  get directory(): string;
  /**
   * Returns the extension of the file, or an empty string if not existing or a directory.
   */
  get extension(): string;
}
```

## File Exists

To check if a file exists use the `exists()` method.

```typescript
if (await filesystem.exists('myFile.txt')) {
  console.log('File exists');
}
```

## File Visibility

Deepkit Filesystems supports a simple file visibility abstraction that can be used to make files public or private.

This is useful for example for S3 or Google Cloud Filesystem. For local filesystem it sets the file permissions depending on the visibility.

To set the visibility of a file use either the `setVisibility()` method or pass the visibility as third argument to `write()`.

```typescript
await filesystem.setVisibility('myFile.txt', 'public');
await filesystem.write('myFile.txt', 'Hello World', 'public');
```

To get the visibility of a file use the `getVisibility()` method or check `FilesystemFile.visibility`.

```typescript
const visibility = await filesystem.getVisibility('myFile.txt');
const file = await filesystem.get('myFile.txt');
console.log(file.visibility);
```

Note that some adapters might not support getting the visibility from `sotrage.files()`. In this case the visibility is always `unknown`.

## File Public URL

To get the public URL of a file use the `publicUrl()` method. This only works if the file is public and the adapter supports it.

```typescript
const url = filesystem.publicUrl('myFile.txt');
```

If the adapter doesn't support public urls, the Filesystem abstraction handles it generating an url by using `option.baseUrl`.

```typescript
const filesystem = new Filesystem(new FilesystemLocalAdapter('/path/to/my/files'), {
  baseUrl: 'https://my-domain.com/assets/',
});

const url = await filesystem.publicUrl('myFile.txt');
console.log(url); //https://my-domain.com/assets/myFile.txt
```

## Filesystem Options

The `Filesystem` constructor accepts a second argument with options.

```typescript
const filesystem = new Filesystem(new FilesystemLocalAdapter('/path/to/my/files'), {
  visibility: 'private', //default visibility for files
  directoryVisibility: 'private', //default visibility for directories
  pathNormalizer: (path: string) => path, //normalizes the path. By default it replaces `[^a-zA-Z0-9\.\-\_]` with `-`.
  urlBuilder: (path: string) => path, //builds the public url for a file. By default it returns baseUrl + path
  baseUrl: '', //base url for public urls
});
```
