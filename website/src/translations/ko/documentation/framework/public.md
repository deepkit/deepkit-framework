# Public 디렉터리

`FrameworkModule`는 HTTP를 통해 이미지, PDF, 바이너리 등과 같은 정적 파일(static files)을 서빙할 수 있는 방법을 제공합니다. `publicDir` 설정 옵션은 HTTP controller route로 연결되지 않는 요청에 대해 기본 entry point로 사용할 폴더를 지정할 수 있게 해줍니다. 기본적으로 이 동작은 비활성화되어 있습니다(빈 값).

공개 파일 제공을 활성화하려면, `publicDir`을 원하는 폴더로 설정하세요. 보통은 명확하도록 폴더 이름을 `publicDir`처럼 정합니다.

```
.
├── app.ts
└── publicDir
    └── logo.jpg
```

`publicDir` 옵션을 변경하려면, `FrameworkModule`의 첫 번째 인자를 변경하면 됩니다.

```typescript
import { App } from '@deepkit/app';
import { FrameworkModule } from '@deepkit/framework';

// 여기에 config와 HTTP controller를 정의하세요

new App({
    config: config,
    controllers: [MyWebsite],
    imports: [
        new FrameworkModule({
            publicDir: 'publicDir'
        })
    ]
})
    .run();
```

이제 이 설정된 폴더 내의 모든 파일은 HTTP로 접근할 수 있습니다. 예를 들어, `http:localhost:8080/logo.jpg`를 열면 `publicDir` 디렉터리의 `logo.jpg` 이미지를 볼 수 있습니다.