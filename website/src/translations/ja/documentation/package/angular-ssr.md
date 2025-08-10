# API `@deepkit/angular-ssr`

```shell
npm install @deepkit/angular-ssr
```


- メインのアプリケーションを `app.ts` に配置し、`angular.json` で設定してください:

`src/server/app.ts` 内:

```typescript
import { App } from '@deepkit/app';
import { FrameworkModule } from '@deepkit/framework';
import { AngularModule, RequestHandler } from '@deepkit/angular-ssr';

const app = new App({
  controllers: [
    // あなたの controllers
  ],
  providers: [
    // あなたの providers
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
  void app.run(); // server:start を含むすべての CLI コマンドを呼び出せるようにする
}

export const reqHandler = main
  // main のときは、新しい request handler を作成したくない
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

`tsconfig` にも `src/server/app.ts` を含めていることを確認してください。

## Angular アプリの設定

`app/app.config.ts`（クライアント側）:

```typescript
@Injectable()
export class APIInterceptor implements HttpInterceptor {
  constructor(@Inject('baseUrl') @Optional() private baseUrl: string) {
    // クライアントビルドでは、`baseUrl` は空であり、現在の location から推論されるべきです。
    // これが正しくない場合は、`appConfig` オブジェクトの `providers` 配列で `baseUrl` を定義するだけで構いません。
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
    // 他の providers
  ],
};
```

`app/app.server.config.ts`（サーバー側）:

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