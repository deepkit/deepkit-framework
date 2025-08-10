# Deepkit Filesystem

Deepkit Filesystem은 로컬 및 원격 파일시스템을 위한 파일시스템 추상화 계층입니다. 파일이 로컬에 저장되어 있든 원격 서버에 저장되어 있든 관계없이, 파일과 디렉터리를 일관된 방식으로 다룰 수 있습니다.

기본적으로 지원되는 파일시스템:

- 로컬 파일시스템 (패키지: `@deepkit/filesystem`)
- 메모리 (패키지: `@deepkit/filesystem`)
- FTP (패키지: `@deepkit/filesystem-ftp`)
- SFTP (패키지: `@deepkit/filesystem-sftp`)
- AWS S3 (패키지: `@deepkit/filesystem-aws-s3`)
- Google Cloud Filesystem (패키지: `@deepkit/filesystem-google`)

## 설치

```bash
npm install @deepkit/filesystem
```

참고: NPM을 사용하지 않는 경우 peer dependencies가 올바르게 설치되어 있는지 확인하세요.

## 사용법

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


## 파일 목록

파일을 나열하려면 `files()` Method를 사용하세요. `File` 객체의 배열을 반환합니다.

```typescript
const files = await filesystem.files();
for (const file of files) {
    console.log(file.path);
}
```

배열이 비어 있다면, 폴더가 없거나 해당 폴더에 파일이 없는 것입니다.

모든 파일을 재귀적으로 나열하려면 `allFiles()` Method를 사용하세요.

```typescript
const files = await filesystem.allFiles();
for (const file of files) {
    console.log(file.path);
}
```

## 파일 읽기

파일을 읽으려면 `read()` Method를 사용하세요. 파일 내용을 `Uint8Array`로 반환합니다.

```typescript
const content = await filesystem.read('myFile.txt');
```

텍스트로 읽으려면 `readAsText()` Method를 사용하세요. string을 반환합니다.

```typescript
const content = await filesystem.readAsText('myFile.txt');
```

## 파일 쓰기

파일을 쓰려면 `write()` Method를 사용하세요. `Uint8Array` 또는 string을 받습니다.

```typescript
await filesystem.write('myFile.txt', 'Hello World');
```

로컬 파일에서 쓰려면 `writeFile()` Method를 사용하세요.

첫 번째 Argument는 파일 이름이 아닌 디렉터리입니다. 파일 이름은 제공된 파일의 basename입니다.
파일 이름을 변경하려면 두 번째 Argument로 {name: 'myFile.txt'} 객체를 전달하세요. 파일 확장자를 제공하지 않으면,
확장자는 자동으로 감지됩니다.

```typescript
const path = await filesystem.writeFile('/', { path: '/path/to/local/file.txt' });

// UploadedFile 과 함께 동작합니다
router.post('/upload', async (body: HttpBody<{ file: UploadedFile }>, filesystem: Filesystem, session: Session) => {
    const user = session.getUser();
    const path = await filesystem.writeFile('/user-images', body.file, { name: `user-${user.id}` });
    //path = /user-images/user-123.jpg
});
```


## 파일 삭제

파일을 삭제하려면 `delete()` Method를 사용하세요.

```typescript
await filesystem.delete('myFile.txt');
```

루트 폴더의 `myFile.txt` 파일을 삭제합니다. 경로가 디렉터리인 경우 Error를 던집니다.

## 디렉터리 삭제

디렉터리를 삭제하려면 `deleteDirectory()` Method를 사용하세요. 디렉터리와 그 안의 모든 파일 및 디렉터리를 삭제합니다.

```typescript
await filesystem.deleteDirectory('myFolder');
```

## 디렉터리 생성

디렉터리를 생성하려면 `createDirectory()` Method를 사용하세요.

```typescript
await filesystem.makeDirectory('myFolder');
```

## 파일 이동

파일 또는 디렉터리를 이동하려면 `move()` Method를 사용하세요. `File` 객체 또는 path를 받습니다.

```typescript
await filesystem.move('myFile.txt', 'myFolder/myFile.txt');
```

`myFolder` 디렉터리가 없으면 생성합니다.

## 파일 복사

파일 또는 디렉터리를 복사하려면 `copy()` Method를 사용하세요. `File` 객체 또는 path를 받습니다.

```typescript
await filesystem.copy('myFile.txt', 'myFolder/myFile.txt');
```

`myFolder` 디렉터리가 없으면 생성합니다.

## 파일 정보

파일 정보를 얻으려면 `get()` Method를 사용하세요. `File` 객체를 반환합니다.

```typescript
const file: FilesystemFile = await filesystem.get('myFile.txt');
console.log(file.path, file.size, file.lastModified);
```

path, 바이트 단위의 파일 크기, 마지막 수정 날짜를 반환합니다. Adapter가 지원하지 않으면 수정 날짜는 undefined일 수 있습니다.

File 객체에는 다음과 같은 유용한 Method도 있습니다:

```typescript
interface FilesystemFile {
    path: string;
    type: FileType; //파일 또는 디렉터리
    size: number;
    lastModified?: Date;
    /**
     * 파일의 visibility.
     *
     * 일부 adapter는 파일의 visibility 읽기를 지원하지 않을 수 있습니다.
     * 이 경우 visibility는 항상 'private'입니다.
     *
     * 일부 adapter는 파일 나열 시에는 visibility를 지원하지 않지만, 개별 파일 조회에서는 지원할 수 있습니다.
     * 이 경우 visibility를 로드하려면 추가로 `filesystem.get(file)` 을 호출해야 합니다.
     */
    visibility: FileVisibility; //public 또는 private
    constructor(path: string, type?: FileType);
    /**
     * 이 파일이 심볼릭 링크인 경우 true를 반환합니다.
     */
    isFile(): boolean;
    /**
     * 이 파일이 디렉터리인 경우 true를 반환합니다.
     */
    isDirectory(): boolean;
    /**
     * 파일의 이름(basename)을 반환합니다.
     */
    get name(): string;
    /**
     * 이 파일이 주어진 디렉터리에 있는 경우 true를 반환합니다.
     */
    inDirectory(directory: string): boolean;
    /**
     * 파일의 디렉터리(dirname)를 반환합니다.
     */
    get directory(): string;
    /**
     * 파일의 확장자를 반환합니다. 존재하지 않거나 디렉터리인 경우 빈 문자열을 반환합니다.
     */
    get extension(): string;
}
```

## 파일 존재 여부

파일이 존재하는지 확인하려면 `exists()` Method를 사용하세요.

```typescript

if (await filesystem.exists('myFile.txt')) {
    console.log('File exists');
}
```

## 파일 Visibility

Deepkit Filesystem은 파일을 public 또는 private으로 설정할 수 있는 단순한 file visibility 추상화를 지원합니다. 

예를 들어 S3나 Google Cloud Filesystem에서 유용합니다. 로컬 파일시스템의 경우 visibility에 따라 파일 권한을 설정합니다.

파일의 visibility를 설정하려면 `setVisibility()` Method를 사용하거나, `write()`의 세 번째 Argument로 visibility를 전달하세요.

```typescript
await filesystem.setVisibility('myFile.txt', 'public');
await filesystem.write('myFile.txt', 'Hello World', 'public');
```

파일의 visibility를 얻으려면 `getVisibility()` Method를 사용하거나 `FilesystemFile.visibility`를 확인하세요.

```typescript
const visibility = await filesystem.getVisibility('myFile.txt');
const file = await filesystem.get('myFile.txt');
console.log(file.visibility);
```

일부 adapter는 `sotrage.files()`에서 visibility를 가져오는 것을 지원하지 않을 수 있습니다. 이 경우 visibility는 항상 `unknown`입니다.

## 파일 공개 URL

파일의 공개 URL을 얻으려면 `publicUrl()` Method를 사용하세요. 이는 파일이 public이고 adapter가 이를 지원하는 경우에만 작동합니다.

```typescript
const url = filesystem.publicUrl('myFile.txt');
```

adapter가 public url을 지원하지 않는 경우, Filesystem 추상화는 `option.baseUrl`을 사용하여 URL을 생성해 처리합니다.

```typescript
const filesystem = new Filesystem(new FilesystemLocalAdapter('/path/to/my/files'), {
    baseUrl: 'https://my-domain.com/assets/'
});

const url = await filesystem.publicUrl('myFile.txt');
console.log(url); //https://my-domain.com/assets/myFile.txt
```

## Filesystem 옵션

`Filesystem` 생성자는 옵션이 포함된 두 번째 Argument를 받습니다.

```typescript
const filesystem = new Filesystem(new FilesystemLocalAdapter('/path/to/my/files'), {
    visibility: 'private', //파일의 기본 visibility
    directoryVisibility: 'private', //디렉터리의 기본 visibility
    pathNormalizer: (path: string) => path, //path를 정규화합니다. 기본적으로 `[^a-zA-Z0-9\.\-\_]` 를 `-` 로 대체합니다.
    urlBuilder: (path: string) => path, //파일의 public URL을 생성합니다. 기본적으로 baseUrl + path를 반환합니다
    baseUrl: '', //public URL을 위한 base URL
});
```