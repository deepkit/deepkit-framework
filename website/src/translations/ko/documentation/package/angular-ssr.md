# API `@deepkit/angular-ssr`

```shell
npm install @deepkit/angular-ssr
```


- 메인 애플리케이션을 `app.ts` 안에 두고 `angular.json`에서 설정하세요:

`src/server/app.ts`에서:

```typescript
import { App } from '@deepkit/app';
import { FrameworkModule } from '@deepkit/framework';
import { AngularModule, RequestHandler } from '@deepkit/angular-ssr';

const app = new App({
  controllers: [
    // 사용자 컨트롤러
  ],
  providers: [
    // 사용자 프로바이더
  ],
  imports: [
    new FrameworkModule({}),
    new AngularModule({
      moduleUrl: import.meta.url,
    })
  ]
});

const main = isMainModule(import.meta.url);

if (main) {
  void app.run(); // server:start를 포함한 모든 CLI 명령을 호출할 수 있게 해줍니다
}

export const reqHandler = main
  // 메인에서 실행 중일 때는 새 request handler를 생성하지 않습니다
  ? () => undefined
  : app.get(RequestHandler).create();
```

```json
{
  "builder": "@angular-devkit/build-angular:application",
  "options": {
    "outputPath": "dist/app",
    "index": "src/index.html",
    "server": "src/main.server.ts",
    "outputMode": "server",
    "ssr": {
      "entry": "src/server/app.ts"
    },
    "browser": "src/main.ts"
  }
}
```

`src/server/app.ts`도 tsconfig에 포함되어 있는지 확인하세요.

## Angular App 구성

`app/app.config.ts`(클라이언트 측)에서:

```typescript
@Injectable()
export class APIInterceptor implements HttpInterceptor {
  constructor(@Inject('baseUrl') @Optional() private baseUrl: string) {
    // 클라이언트 빌드에서는 `baseUrl`이 비어 있으며, 현재 location에서 유추되어야 합니다.
    // 이것이 올바르지 않다면, `appConfig` 객체의 `providers` 배열에서 `baseUrl`을 간단히 정의할 수 있습니다.
    this.baseUrl = baseUrl || (typeof location !== 'undefined' ? location.origin : '');
  }

  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    const apiReq = req.clone({ url: `${this.baseUrl}/${req.url}` });
    return next.handle(apiReq);
  }
}

export const appConfig: ApplicationConfig = {
  providers: [
    {
      provide: HTTP_INTERCEPTORS,
      useClass: APIInterceptor,
      multi: true,
    },
    // 기타 프로바이더
  ],
};
```

`app/app.server.config.ts`(서버 측)에서:

```typescript
import { appConfig } from './app.config';

const serverConfig: ApplicationConfig = {
  providers: [
    provideServerRendering(),
    provideServerRouting([
      {
        path: '**',
        renderMode: RenderMode.Server,
      },
    ]),
    {
      provide: HTTP_TRANSFER_CACHE_ORIGIN_MAP,
      deps: [REQUEST_CONTEXT],
      useFactory(context: any) {
        return { [context?.baseUrl]: context?.publicBaseUrl || '' };
      },
    },
    {
      provide: 'baseUrl',
      deps: [REQUEST_CONTEXT],
      useFactory: (context: any) => {
        return context?.baseUrl || '';
      },
    }
  ],
};

export const config = mergeApplicationConfig(appConfig, serverConfig);
```


<api-docs package="@deepkit/angular-ssr"></api-docs>