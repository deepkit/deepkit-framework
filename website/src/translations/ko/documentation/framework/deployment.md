# 배포

이 장에서는 애플리케이션을 JavaScript로 컴파일하고, 프로덕션 환경에 맞게 구성한 뒤, Docker를 사용해 배포하는 방법을 배웁니다.

## TypeScript 컴파일

`app.ts` 파일에 다음과 같은 애플리케이션이 있다고 가정해봅시다:

```typescript
#!/usr/bin/env ts-node-script
import { App } from '@deepkit/app';
import { FrameworkModule } from '@deepkit/framework';
import { http } from '@deepkit/http';

class Config {
    title: string = 'DEV my Page';
}

class MyWebsite {
    constructor(protected title: Config['title']) {
    }

    @http.GET()
    helloWorld() {
        return 'Hello from ' + this.title;
    }
}

new App({
    config: Config,
    controllers: [MyWebsite],
    imports: [new FrameworkModule]
})
    .loadConfigFromEnv()
    .run();
```

`ts-node app.ts server:start` 를 사용하면 모든 것이 정상 작동하는 것을 확인할 수 있습니다. 프로덕션 환경에서는 일반적으로 `ts-node`로 서버를 시작하지 않습니다. 대신 JavaScript로 컴파일한 다음 Node로 실행합니다. 이를 위해서는 올바른 설정 옵션이 포함된 `tsconfig.json`이 필요합니다. “첫 번째 애플리케이션” 섹션에서는 `tsconfig.json`이 JavaScript 출력을 `.dist` 폴더로 내보내도록 설정되어 있습니다. 여기서도 동일하게 설정되어 있다고 가정합니다.

컴파일러 설정이 모두 올바르고 `outDir`가 `dist`와 같은 폴더를 가리킨다면, 프로젝트에서 `tsc` 명령을 실행하는 즉시 `tsconfig.json`에 연결된 파일들이 모두 JavaScript로 컴파일됩니다. 이 목록에는 엔트리 파일만 지정하면 충분합니다. import된 파일은 자동으로 함께 컴파일되므로 `tsconfig.json`에 명시적으로 추가할 필요가 없습니다. `tsc`는 `npm install typescript`로 설치할 때 함께 제공되는 TypeScript의 일부입니다.

```sh
$ ./node_modules/.bin/tsc
```

TypeScript 컴파일러는 성공했을 때 아무 출력도 하지 않습니다. 이제 `dist`의 출력을 확인할 수 있습니다.

```sh
$ tree dist
dist
└── app.js
```

파일이 하나만 있는 것을 볼 수 있습니다. `node distapp.js`로 실행하면 `ts-node app.ts`와 동일한 기능을 얻을 수 있습니다.

배포를 위해서는 TypeScript 파일이 올바르게 컴파일되고 모든 것이 Node에서 직접 동작하는 것이 중요합니다. 이제 `node_modules`를 포함한 `dist` 폴더를 그대로 옮겨 `node distapp.js server:start`를 실행하면 앱이 성공적으로 배포됩니다. 하지만 일반적으로는 Docker와 같은 다른 솔루션을 사용해 앱을 올바르게 패키징합니다.

## 구성

프로덕션 환경에서는 서버를 `localhost`에 바인딩하지 않고 보통 `0.0.0.0`을 통해 모든 인터페이스에 바인딩합니다. 리버스 프록시 뒤에 있지 않다면 포트도 80으로 설정할 것입니다. 이 두 설정을 구성하려면 `FrameworkModule`을 커스터마이즈해야 합니다. 관심 있는 두 옵션은 `host`와 `port`입니다. 이 값을 환경 변수나 .dotenv 파일을 통해 외부에서 설정할 수 있도록 하려면, 먼저 이를 허용해야 합니다. 다행히 위 코드에서는 `loadConfigFromEnv()` 메서드로 이미 설정해 두었습니다.

애플리케이션 구성 옵션을 설정하는 방법에 대해 더 알아보려면 [구성](../app/configuration.md) 장을 참고하세요.

사용 가능한 구성 옵션과 그 값들을 확인하려면 `ts-node app.ts app:config` 명령을 사용할 수 있습니다. Framework Debugger에서도 확인할 수 있습니다.

### SSL

애플리케이션을 SSL이 적용된 HTTPS로 실행하는 것이 권장되며(때로는 필수이기도 합니다). SSL을 구성하기 위한 여러 옵션이 있습니다. SSL을 활성화하려면
`framework.ssl`을 사용하고 다음 옵션들로 매개변수를 구성하세요.

|===
|이름|Type|설명

|framework.ssl|boolean|true일 때 HTTPS 서버를 활성화합니다
|framework.httpsPort|number?|httpsPort와 ssl이 정의되어 있으면, http 서버에 추가로 https 서버가 시작됩니다.
|framework.sslKey|string?|HTTPS용 SSL key 파일의 경로
|framework.sslCertificate|string?|HTTPS용 certificate 파일의 경로
|framework.sslCa|string?|HTTPS용 CA 파일의 경로
|framework.sslCrl|string?|HTTPS용 CRL 파일의 경로
|framework.sslOptions|object?|tls.SecureContextOptions 및 tls.TlsOptions와 동일한 인터페이스.
|===

```typescript
import { App } from '@deepkit/app';
import { FrameworkModule } from '@deepkit/framework';

// 여기에서 config와 HTTP controller를 정의합니다

new App({
    config: Config,
    controllers: [MyWebsite],
    imports: [
        new FrameworkModule({
            ssl: true,
            selfSigned: true,
            sslKey: __dirname + 'path/ssl.key',
            sslCertificate: __dirname + 'path/ssl.cert',
            sslCA: __dirname + 'path/ssl.ca',
        })
    ]
})
    .run();
```

### 로컬 SSL

로컬 개발 환경에서는 `framework.selfSigned` 옵션으로 self-signed HTTPS를 활성화할 수 있습니다.

```typescript
import { App } from '@deepkit/app';
import { FrameworkModule } from '@deepkit/framework';

// 여기에서 config와 HTTP controller를 정의합니다

new App({
    config: config,
    controllers: [MyWebsite],
    imports: [
        new FrameworkModule({
            ssl: true,
            selfSigned: true,
        })
    ]
})
    .run();
```

```sh
$ ts-node app.ts server:start
2021-06-13T18:04:01.563Z [LOG] Start HTTP server, using 1 workers.
2021-06-13T18:04:01.598Z [LOG] Self signed certificate for localhost created at var/self-signed-localhost.cert
2021-06-13T18:04:01.598Z [LOG] Tip: If you want to open this server via chrome for localhost, use chrome://flags/#allow-insecure-localhost
2021-06-13T18:04:01.606Z [LOG] HTTP MyWebsite
2021-06-13T18:04:01.606Z [LOG]     GET / helloWorld
2021-06-13T18:04:01.606Z [LOG] HTTPS listening at https://localhost:8080/
```

이 서버를 지금 시작하면 HTTP 서버가 `https:localhost:8080`에서 HTTPS로 제공됩니다. Chrome에서 이 URL을 열면 self-signed 인증서는 보안 위험으로 간주되기 때문에 "NET::ERR_CERT_INVALID" 오류 메시지가 표시됩니다: `chrome:flagsallow-insecure-localhost`.