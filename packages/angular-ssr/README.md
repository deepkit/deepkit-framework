# Deepkit + Angular SSR

## Configure Deepkit App

- Make sure to put your main application inside `app.ts` and export the `App` instance:

In `src/server/app.ts`:

```typescript
import { App } from '@deepkit/app';
import { FrameworkModule } from '@deepkit/framework';
import { AngularModule } from '@deepkit/angular-ssr';

export const app = new App({
  controllers: [
    // your controllers
  ],
  providers: [
    // your providers
  ],
  imports: [
    new FrameworkModule({}),
    new AngularModule()
  ]
});
```

Create a `src/server/server.ts` and configure it in your `angular.json`:

```json
{
  "builder": "@angular-devkit/build-angular:application",
  "options": {
    "outputPath": "dist/app",
    "index": "src/index.html",
    "server": "src/main.server.ts",
    "outputMode": "server",
    "ssr": {
      "entry": "src/server/server.ts"
    },
    "browser": "src/main.ts"
  }
}
```

In `src/server/server.ts`:

```typescript
import { app } from './app';
import { RequestHandler } from '@deepkit/angular-ssr';

export const reqHandler = app.get(RequestHandler).create(import.meta.url);
````

## Configure Angular App

In `app/app.config.ts` (client side):

```typescript
@Injectable()
export class APIInterceptor implements HttpInterceptor {
  constructor(@Inject('baseUrl') @Optional() private baseUrl: string) {
    // In client build, `baseUrl` is empty and should be inferred from the current location.
    // If this is not correct, you can simply define the `baseUrl` in the `providers` array of the `appConfig` object.
    this.baseUrl = baseUrl || (typeof location !== 'undefined' ? location.origin : '');
  }

  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    const apiReq = req.clone({ url: `your-api-url/${req.url}` });
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
    // your other providers
  ],
};
```

In `app/app.server.config.ts` (server side):

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
