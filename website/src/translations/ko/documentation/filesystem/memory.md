# 메모리 파일시스템

메모리 파일시스템의 경우 파일시스템이 메모리에 저장됩니다. 이는 파일시스템이 영구적이지 않으며 애플리케이션이 종료되면 사라진다는 의미입니다.
이는 특히 테스트 목적에 유용합니다.

이는 `@deepkit/filesystem`의 일부이므로 추가 설치가 필요하지 않습니다.

## 사용법

```typescript
import { FilesystemMemoryAdapter, Filesystem } from '@deepkit/filesystem';

const adapter = new FilesystemMemoryAdapter();
const filesystem = new Filesystem(adapter);
```