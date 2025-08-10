# API `@deepkit/angular-ssr`

```shell
npm install @deepkit/angular-ssr
```


- 请确保将你的主应用程序放在 `app.ts` 中，并在 `angular.json` 中进行配置：

在 `src/server/app.ts`：

```typescript
import { App } from '@deepkit/app';
import { FrameworkModule } from '@deepkit/framework';
import { AngularModule, RequestHandler } from '@deepkit/angular-ssr';

const app = new App({
  controllers: [
    // 你的控制器
  ],
  providers: [
    // 你的提供者
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
  void app.run(); // 允许调用所有 CLI 命令，包括 server:start
}

export const reqHandler = main
  // 处于 main 时，我们不希望创建新的请求处理器
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

请确保在 tsconfig 中也包含 `src/server/app.ts`。

## 配置 Angular 应用

在 `app/app.config.ts`（客户端）：

```typescript
@Injectable()
export class APIInterceptor implements HttpInterceptor {
  constructor(@Inject('baseUrl') @Optional() private baseUrl: string) {
    // 在客户端构建中，`baseUrl` 为空，应从当前地址推断。
    // 如果这不符合你的需求，你可以直接在 `appConfig` 对象的 `providers` 数组中定义 `baseUrl`。
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
    // 你的其他提供者
  ],
};
```

在 `app/app.server.config.ts`（服务端）：

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