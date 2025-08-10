# sFTP (SSH) Filesystem

이 adapter는 sFTP (SSH) 서버를 filesystem으로 사용할 수 있게 해줍니다.

이는 `@deepkit/filesystem-sftp`의 일부로, 별도로 설치해야 합니다.

```sh
npm install @deepkit/filesystem-sftp
```

## 사용법

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

참고: 자격 증명을 코드에 직접 저장하지 마세요. 대신 환경 변수 또는 [App Configuration](./app.md#configuration)을 사용하세요.

이 adapter는 [ssh2-sftp-client](https://npmjs.com/package/ssh2-sftp-client)의 sFTP client를 사용합니다. 해당 패키지의 모든 configuration 옵션을 adapter constructor에 전달할 수 있습니다.

## Permissions

FTP 서버가 Unix 환경에서 실행 중이라면, [local filesystem adapter](./local.md)와 마찬가지로 `permissions` 옵션을 사용해 파일과 폴더의 permissions를 설정할 수 있습니다.

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

여기서는 파일 `/hello-public.txt`가 `0o644` permissions로, `/hello-private.txt`가 `0o600`으로 생성됩니다.