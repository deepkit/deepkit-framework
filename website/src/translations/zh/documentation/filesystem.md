# Deepkit 文件系统

Deepkit 文件系统是一个用于本地和远程文件系统的抽象层。它让你以统一的方式处理文件和目录，无论文件存储在本地还是在远程服务器上。

开箱即用的受支持文件系统：

- 本地文件系统（包含于 `@deepkit/filesystem`）
- 内存（包含于 `@deepkit/filesystem`）
- FTP（包含于 `@deepkit/filesystem-ftp`）
- SFTP（包含于 `@deepkit/filesystem-sftp`）
- AWS S3（包含于 `@deepkit/filesystem-aws-s3`）
- Google 云文件系统（包含于 `@deepkit/filesystem-google`）

## 安装

```bash
npm install @deepkit/filesystem
```

注意：如果你不使用 NPM，请确保正确安装对等依赖。

## 用法

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


## 列出文件

要列出文件，请使用 `files()` 方法。它返回一个 `File` 对象数组。

```typescript
const files = await filesystem.files();
for (const file of files) {
    console.log(file.path);
}
```

如果数组为空，要么该文件夹不存在，要么其中没有文件。

要递归列出所有文件，请使用 `allFiles()` 方法。

```typescript
const files = await filesystem.allFiles();
for (const file of files) {
    console.log(file.path);
}
```

## 读取文件

要读取文件，请使用 `read()` 方法。它以 `Uint8Array` 形式返回文件内容。

```typescript
const content = await filesystem.read('myFile.txt');
```

要以文本方式读取，请使用 `readAsText()` 方法。它返回一个字符串。

```typescript
const content = await filesystem.readAsText('myFile.txt');
```

## 写入文件

要写入文件，请使用 `write()` 方法。它接受 `Uint8Array` 或字符串。

```typescript
await filesystem.write('myFile.txt', 'Hello World');
```

要从本地文件写入，请使用 `writeFile()` 方法。

注意，第一个参数是目录而不是文件名。文件名是所提供文件的基础名（basename）。
你可以通过传递 {name: 'myFile.txt'} 对象作为第二个参数来更改文件名。如果未提供文件扩展名，
则会自动检测扩展名。

```typescript
const path = await filesystem.writeFile('/', { path: '/path/to/local/file.txt' });

// 适用于 UploadedFile
router.post('/upload', async (body: HttpBody<{ file: UploadedFile }>, filesystem: Filesystem, session: Session) => {
    const user = session.getUser();
    const path = await filesystem.writeFile('/user-images', body.file, { name: `user-${user.id}` });
    // 路径 = /user-images/user-123.jpg
});
```


## 删除文件

要删除文件，请使用 `delete()` 方法。

```typescript
await filesystem.delete('myFile.txt');
```

这将删除根文件夹中的 `myFile.txt`。如果该路径是一个目录，则会抛出错误。

## 删除目录

要删除目录，请使用 `deleteDirectory()` 方法。这会删除该目录以及其中的所有文件和子目录。

```typescript
await filesystem.deleteDirectory('myFolder');
```

## 创建目录

要创建目录，请使用 `createDirectory()` 方法。

```typescript
await filesystem.makeDirectory('myFolder');
```

## 移动文件

要移动文件或目录，请使用 `move()` 方法。它接受 `File` 对象或路径。

```typescript
await filesystem.move('myFile.txt', 'myFolder/myFile.txt');
```

如果目录 `myFolder` 不存在，将会自动创建。

## 复制文件

要复制文件或目录，请使用 `copy()` 方法。它接受 `File` 对象或路径。

```typescript
await filesystem.copy('myFile.txt', 'myFolder/myFile.txt');
```

如果目录 `myFolder` 不存在，将会自动创建。

## 文件信息

要获取文件信息，请使用 `get()` 方法。它返回一个 `File` 对象。

```typescript
const file: FilesystemFile = await filesystem.get('myFile.txt');
console.log(file.path, file.size, file.lastModified);
```

它返回路径、以字节为单位的文件大小以及最后修改日期。如果适配器不支持，修改日期可能为 undefined。

File 对象还提供了一些方便的方法：

```typescript
interface FilesystemFile {
    path: string;
    type: FileType; // 文件或目录
    size: number;
    lastModified?: Date;
    /**
     * 文件的可见性。
     *
     * 请注意，某些适配器可能不支持读取文件的可见性。
     * 在这种情况下，可见性始终为 'private'。
     *
     * 有些适配器可能支持按文件读取可见性，但在列出文件时不支持。
     * 在这种情况下，你需要额外调用 `filesystem.get(file)` 来加载可见性。
     */
    visibility: FileVisibility; // 公共或私有
    constructor(path: string, type?: FileType);
    /**
     * 如果此文件是符号链接则返回 true。
     */
    isFile(): boolean;
    /**
     * 如果此文件是目录则返回 true。
     */
    isDirectory(): boolean;
    /**
     * 返回文件名（basename）。
     */
    get name(): string;
    /**
     * 如果此文件位于给定目录中则返回 true。
     */
    inDirectory(directory: string): boolean;
    /**
     * 返回文件的目录（dirname）。
     */
    get directory(): string;
    /**
     * 返回文件的扩展名；如果不存在或是目录，则返回空字符串。
     */
    get extension(): string;
}
```

## 文件是否存在

要检查文件是否存在，请使用 `exists()` 方法。

```typescript

if (await filesystem.exists('myFile.txt')) {
    console.log('File exists');
}
```

## 文件可见性

Deepkit 文件系统支持一个简单的文件可见性抽象，可用于将文件设为公开或私有。 

这对于 S3 或 Google 云文件系统等非常有用。对于本地文件系统，它会根据可见性设置文件权限。

要设置文件的可见性，请使用 `setVisibility()` 方法，或在调用 `write()` 时将可见性作为第三个参数传入。

```typescript
await filesystem.setVisibility('myFile.txt', 'public');
await filesystem.write('myFile.txt', 'Hello World', 'public');
```

要获取文件的可见性，请使用 `getVisibility()` 方法或查看 `FilesystemFile.visibility`。

```typescript
const visibility = await filesystem.getVisibility('myFile.txt');
const file = await filesystem.get('myFile.txt');
console.log(file.visibility);
```

请注意，某些适配器可能不支持从 `sotrage.files()` 获取可见性。在这种情况下，可见性始终为 `unknown`。

## 文件公共 URL

要获取文件的公共 URL，请使用 `publicUrl()` 方法。仅当文件为公开且适配器支持时此方法才有效。

```typescript
const url = filesystem.publicUrl('myFile.txt');
```

如果适配器不支持公共 URL，Filesystem 抽象会通过使用 `option.baseUrl` 来生成一个 URL。

```typescript
const filesystem = new Filesystem(new FilesystemLocalAdapter('/path/to/my/files'), {
    baseUrl: 'https://my-domain.com/assets/'
});

const url = await filesystem.publicUrl('myFile.txt');
console.log(url); //https://my-domain.com/assets/myFile.txt
```

## 文件系统选项

`Filesystem` 构造函数接受一个带有选项的第二个参数。

```typescript
const filesystem = new Filesystem(new FilesystemLocalAdapter('/path/to/my/files'), {
    visibility: 'private', // 文件的默认可见性
    directoryVisibility: 'private', // 目录的默认可见性
    pathNormalizer: (path: string) => path, // 规范化路径。默认将 `[^a-zA-Z0-9\.\-\_]` 替换为 `-`。
    urlBuilder: (path: string) => path, // 为文件构建公共 URL。默认返回 baseUrl + path
    baseUrl: '', // 公共 URL 的基础地址
});
```