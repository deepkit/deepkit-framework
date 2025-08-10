# Deepkit Filesystem

Deepkit Filesystem は、ローカルおよびリモートのファイルシステム向けのファイルシステム抽象化レイヤーです。ファイルがローカルに保存されているかリモートサーバーに保存されているかに関係なく、ファイルやディレクトリを統一的な方法で扱えるようにします。

標準でサポートされているファイルシステム:

- ローカルファイルシステム（`@deepkit/filesystem` に同梱）
- メモリ（`@deepkit/filesystem` に同梱）
- FTP（`@deepkit/filesystem-ftp` に同梱）
- SFTP（`@deepkit/filesystem-sftp` に同梱）
- AWS S3（`@deepkit/filesystem-aws-s3` に同梱）
- Google Cloud Filesystem（`@deepkit/filesystem-google` に同梱）

## インストール

```bash
npm install @deepkit/filesystem
```

注意: NPM を使用しない場合は、peer dependencies が正しくインストールされていることを確認してください。

## 使い方

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


## ファイル一覧

ファイルを一覧するには `files()` Method を使用します。`File` オブジェクトの配列を返します。

```typescript
const files = await filesystem.files();
for (const file of files) {
    console.log(file.path);
}
```

配列が空の場合、フォルダが存在しないか、中にファイルがありません。

すべてのファイルを再帰的に一覧するには `allFiles()` Method を使用します。

```typescript
const files = await filesystem.allFiles();
for (const file of files) {
    console.log(file.path);
}
```

## ファイルの読み取り

ファイルを読み取るには `read()` Method を使用します。ファイル内容を `Uint8Array` として返します。

```typescript
const content = await filesystem.read('myFile.txt');
```

テキストとして読み取るには `readAsText()` Method を使用します。文字列を返します。

```typescript
const content = await filesystem.readAsText('myFile.txt');
```

## ファイルの書き込み

ファイルを書き込むには `write()` Method を使用します。`Uint8Array` または文字列を受け付けます。

```typescript
await filesystem.write('myFile.txt', 'Hello World');
```

ローカルファイルから書き込むには `writeFile()` Method を使用します。

最初の引数はファイル名ではなくディレクトリであることに注意してください。ファイル名は、指定したファイルのベース名です。
ファイル名は第2引数に {name: 'myFile.txt'} オブジェクトを渡すことで変更できます。拡張子が指定されていない場合は、
拡張子は自動的に検出されます。

```typescript
const path = await filesystem.writeFile('/', { path: '/path/to/local/file.txt' });

// UploadedFile に対応
router.post('/upload', async (body: HttpBody<{ file: UploadedFile }>, filesystem: Filesystem, session: Session) => {
    const user = session.getUser();
    const path = await filesystem.writeFile('/user-images', body.file, { name: `user-${user.id}` });
    //path = /user-images/user-123.jpg
});
```


## ファイルの削除

ファイルを削除するには `delete()` Method を使用します。

```typescript
await filesystem.delete('myFile.txt');
```

これはルートフォルダ内の `myFile.txt` を削除します。パスがディレクトリの場合は Error をスローします。

## ディレクトリの削除

ディレクトリを削除するには `deleteDirectory()` Method を使用します。ディレクトリと、その中のすべてのファイルおよびディレクトリを削除します。

```typescript
await filesystem.deleteDirectory('myFolder');
```

## ディレクトリの作成

ディレクトリを作成するには `createDirectory()` Method を使用します。

```typescript
await filesystem.makeDirectory('myFolder');
```

## ファイルの移動

ファイルまたはディレクトリを移動するには `move()` Method を使用します。`File` オブジェクトまたはパスを受け付けます。

```typescript
await filesystem.move('myFile.txt', 'myFolder/myFile.txt');
```

`myFolder` ディレクトリが存在しない場合は作成されます。

## ファイルのコピー

ファイルまたはディレクトリをコピーするには `copy()` Method を使用します。`File` オブジェクトまたはパスを受け付けます。

```typescript
await filesystem.copy('myFile.txt', 'myFolder/myFile.txt');
```

`myFolder` ディレクトリが存在しない場合は作成されます。

## ファイル情報

ファイル情報を取得するには `get()` Method を使用します。`File` オブジェクトを返します。

```typescript
const file: FilesystemFile = await filesystem.get('myFile.txt');
console.log(file.path, file.size, file.lastModified);
```

パス、バイト単位のファイルサイズ、最終更新日時を返します。アダプタがサポートしていない場合、更新日時は undefined の可能性があります。

File オブジェクトには便利な Method もいくつかあります:

```typescript
interface FilesystemFile {
    path: string;
    type: FileType; //ファイルまたはディレクトリ
    size: number;
    lastModified?: Date;
    /**
     * ファイルの可視性。
     *
     * 一部のアダプタはファイルの可視性の読み取りをサポートしていない場合があります。
     * この場合、可視性は常に 'private' になります。
     *
     * 一部のアダプタはファイルごとの可視性の読み取りをサポートしますが、一覧時にはサポートしない場合があります。
     * この場合、可視性を読み込むために追加で `filesystem.get(file)` を呼び出す必要があります。
     */
    visibility: FileVisibility; //public または private
    constructor(path: string, type?: FileType);
    /**
     * このファイルがシンボリックリンクの場合に true を返します。
     */
    isFile(): boolean;
    /**
     * このファイルがディレクトリの場合に true を返します。
     */
    isDirectory(): boolean;
    /**
     * ファイルの名前（ベース名）を返します。
     */
    get name(): string;
    /**
     * このファイルが指定されたディレクトリ内にある場合に true を返します。
     */
    inDirectory(directory: string): boolean;
    /**
     * ファイルのディレクトリ名（dirname）を返します。
     */
    get directory(): string;
    /**
     * ファイルの拡張子を返します。存在しない場合やディレクトリの場合は空文字列を返します。
     */
    get extension(): string;
}
```

## ファイルの存在確認

ファイルの存在を確認するには `exists()` Method を使用します。

```typescript

if (await filesystem.exists('myFile.txt')) {
    console.log('File exists');
}
```

## ファイルの可視性

Deepkit Filesystems は、ファイルを public または private にできるシンプルなファイル可視性の抽象化をサポートしています。

これは、例えば S3 や Google Cloud Filesystem に便利です。ローカルファイルシステムでは、可視性に応じてファイルのパーミッションを設定します。

ファイルの可視性を設定するには、`setVisibility()` Method を使用するか、`write()` の第3引数として可視性を渡します。

```typescript
await filesystem.setVisibility('myFile.txt', 'public');
await filesystem.write('myFile.txt', 'Hello World', 'public');
```

ファイルの可視性を取得するには、`getVisibility()` Method を使用するか、`FilesystemFile.visibility` を確認します。

```typescript
const visibility = await filesystem.getVisibility('myFile.txt');
const file = await filesystem.get('myFile.txt');
console.log(file.visibility);
```

一部のアダプタは `sotrage.files()` から可視性の取得をサポートしていない場合があります。この場合、可視性は常に `unknown` です。

## ファイルの公開 URL

ファイルの公開 URL を取得するには `publicUrl()` Method を使用します。これはファイルが public であり、かつアダプタがそれをサポートしている場合にのみ機能します。

```typescript
const url = filesystem.publicUrl('myFile.txt');
```

アダプタが公開 URL をサポートしていない場合、Filesystem の抽象化は `option.baseUrl` を使用して URL を生成して対応します。

```typescript
const filesystem = new Filesystem(new FilesystemLocalAdapter('/path/to/my/files'), {
    baseUrl: 'https://my-domain.com/assets/'
});

const url = await filesystem.publicUrl('myFile.txt');
console.log(url); //https://my-domain.com/assets/myFile.txt
```

## Filesystem のオプション

`Filesystem` のコンストラクタは第2引数にオプションを受け取ります。

```typescript
const filesystem = new Filesystem(new FilesystemLocalAdapter('/path/to/my/files'), {
    visibility: 'private', //ファイルのデフォルト可視性
    directoryVisibility: 'private', //ディレクトリのデフォルト可視性
    pathNormalizer: (path: string) => path, //パスを正規化します。デフォルトでは `[^a-zA-Z0-9\.\-\_]` を `-` に置き換えます。
    urlBuilder: (path: string) => path, //ファイルの公開 URL を構築します。デフォルトでは baseUrl + path を返します
    baseUrl: '', //公開 URL 用のベース URL
});
```