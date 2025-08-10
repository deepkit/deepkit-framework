# 로컬 파일시스템

로컬 파일시스템 어댑터는 가장 일반적인 파일시스템 중 하나로, 애플리케이션이 실행 중인 파일시스템에 접근할 수 있도록 합니다.

이는 `@deepkit/filesystem`의 일부이며 내부적으로 Node의 `fs/promises` API를 사용하므로 추가 설치가 필요하지 않습니다.

## 사용법

```typescript
import { FilesystemLocalAdapter, Filesystem } from '@deepkit/filesystem';

const adapter = new FilesystemLocalAdapter({ root: '/path/to/files' });
const filesystem = new Filesystem(adapter);
```

여기서 `root` 옵션은 파일시스템의 루트 디렉터리입니다. 모든 경로는 이 루트를 기준으로 상대 경로입니다.

```typescript
// 파일 /path/to/files/hello.txt 를 읽습니다
const content: string = await filesystem.readAsText('/hello.txt');
```

## 권한

파일과 디렉터리를 생성할 때 파일시스템이 사용할 권한을 구성할 수 있습니다. 각 카테고리 (file, directory)는 두 가지 visibility: `public` 및 `private`에 대해 별도로 설정할 수 있습니다.

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

여기서 파일 `/hello-public.txt`는 권한 `0o644`로, `/hello-private.txt`는 `0o600`으로 생성됩니다.