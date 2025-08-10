# AWS S3 파일시스템

AWS S3 filesystem adapter는 AWS S3 서비스를 Deepkit Filesystem으로 사용할 수 있게 합니다.

이는 별도로 설치해야 하는 `@deepkit/filesystem-aws-s3`의 일부입니다.

```sh
npm install @deepkit/filesystem-aws-s3
```

## 사용법

```typescript
import { Filesystem } from '@deepkit/filesystem';
import { FilesystemAwsS3Adapter } from '@deepkit/filesystem-aws-s3';

const adapter = new FilesystemAwsS3Adapter({
    bucket: 'my-bucket',
    path: 'starting-path/', // 선택 사항
    region: 'eu-central-1',
    acccessKeyId: '...',
    secretAccessKey: '...'
});
const filesystem = new Filesystem(adapter);
```

참고: 자격 증명을 코드에 직접 저장하지 마세요. 대신 환경 변수 또는 [앱 구성](./app.md#configuration)을 사용하세요.

이 adapter는 [@aws-sdk/client-s3](https://npmjs.com/package/@aws-sdk/client-s3)의 S3 client를 사용합니다. 모든 configuration 옵션은 adapter 생성자에 전달할 수 있습니다.

## 권한

파일이 생성될 때 어떤 visibility를 가질지 구성할 수 있습니다.

```typescript
const filesystem = new Filesystem(adapter);

filesystem.write('/hello-public.txt', 'hello world', 'public');
filesystem.write('/hello-private.txt', 'hello world', 'private');
```

파일 `/hello-public.txt`는 ACL `public-read`로 생성되며, URL을 통해 누구나 읽을 수 있습니다. 해당 URL은 `filesystem.publicUrl`을 사용해 가져올 수 있습니다.

```typescript
const url = filesystem.publicUrl('/hello-public.txt');
// https://my-bucket.s3.eu-central-1.amazonaws.com/starting-path/hello-public.txt
```

visibility를 사용하려면 S3 bucket에서 object-based ACL을 활성화해야 합니다.