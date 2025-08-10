# FTP 파일 시스템

이 어댑터는 FTP 서버를 파일 시스템으로 사용할 수 있게 해줍니다.

이는 별도로 설치해야 하는 `@deepkit/filesystem-ftp`의 일부입니다.

```sh
npm install @deepkit/filesystem-ftp
```

## 사용법

```typescript
import { Filesystem } from '@deepkit/filesystem';
import { FilesystemFtpAdapter } from '@deepkit/filesystem-ftp';

const adapter = new FilesystemFtpAdapter({
    root: 'folder',
    host: 'localhost',
    port: 21,
    username: 'user',
    password: 'password',
});
const filesystem = new Filesystem(adapter);
```

참고: 인증 정보를 코드에 직접 저장하지 마세요. 대신 환경 변수 또는 [앱 구성](./app.md#configuration)을 사용하세요.

## 권한

FTP 서버가 Unix 환경에서 실행 중이라면, [로컬 파일 시스템 어댑터](./local.md)와 마찬가지로 `permissions` 옵션을 사용하여 파일과 폴더의 권한을 설정할 수 있습니다.

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

여기서는 파일 `/hello-public.txt`가 권한 `0o644`로 생성되고, `/hello-private.txt`는 `0o600`으로 생성됩니다.