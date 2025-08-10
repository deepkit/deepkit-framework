# Google Storage 파일시스템

이 어댑터는 Google Storage를 파일시스템으로 사용할 수 있게 해줍니다.

이는 별도로 설치해야 하는 `@deepkit/filesystem-google`의 일부입니다.

```sh
npm install @deepkit/filesystem-google
```

## 사용법

```typescript
import { Filesystem } from '@deepkit/filesystem';
import { FilesystemGoogleAdapter } from '@deepkit/filesystem-google';

const adapter = new FilesystemGoogleAdapter({
    bucket: 'my-bucket',
    path: 'starting-path/', // 선택 사항
    projectId: '...',
    keyFilename: 'path/to/service-account-key.json'
});
const filesystem = new Filesystem(adapter);
```

참고: 자격 증명을 코드에 직접 저장하지 마세요. 대신 환경 변수 또는 [앱 구성](./app.md#configuration)을 사용하세요.

이 어댑터는 [@google-cloud/storage](https://npmjs.com/package/@google-cloud/storage)의 Google Storage 클라이언트를 사용합니다.
해당 클라이언트의 모든 구성 옵션을 어댑터 생성자에 전달할 수 있습니다.

## 권한

파일이 생성될 때 어떤 가시성(visibility)을 가질지 구성할 수 있습니다.

```typescript
const filesystem = new Filesystem(adapter);

filesystem.write('/hello-public.txt', 'hello world', 'public');
filesystem.write('/hello-private.txt', 'hello world', 'private');
```

파일 `/hello-public.txt`는 ACL `public: true`로 생성되며, URL을 통해 누구나 읽을 수 있습니다. 해당 URL은 `filesystem.publicUrl`을 사용해 가져올 수 있습니다.

```typescript
const url = filesystem.publicUrl('/hello-public.txt');
// https://storage.googleapis.com/my-bucket/starting-path/hello-public.txt
```

visibility를 사용하려면 Google Storage 버킷에서 객체 기반(object-based) ACL을 활성화해야 합니다.