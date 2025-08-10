# API `@deepkit/angular-ssr`

```shell
npm install @deepkit/angular-ssr
```


- Stellen Sie sicher, dass sich Ihre Hauptanwendung in `app.ts` befindet und konfigurieren Sie sie in Ihrer `angular.json`:

In `src/server/app.ts`:

```typescript
import { App } from '@deepkit/app';
import { FrameworkModule } from '@deepkit/framework';
import { AngularModule, RequestHandler } from '@deepkit/angular-ssr';

const app = new App({
  controllers: [
    // Ihre Controllers
  ],
  providers: [
    // Ihre Providers
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
  void app.run(); //ermöglicht das Ausführen aller CLI-Befehle, einschließlich server:start
}

export const reqHandler = main
  //wenn im main, möchten wir keinen neuen Request-Handler erstellen
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

Stellen Sie sicher, dass sich `src/server/app.ts` ebenfalls in Ihrer tsconfig befindet.

## Angular-App konfigurieren

In `app/app.config.ts` (Client-Seite):

```typescript
@Injectable()
export class APIInterceptor implements HttpInterceptor {
  constructor(@Inject('baseUrl') @Optional() private baseUrl: string) {
    // Im Client-Build ist `baseUrl` leer und sollte aus der aktuellen Location abgeleitet werden.
    // Falls das nicht korrekt ist, können Sie die `baseUrl` einfach im `providers`-Array des `appConfig`-Objekts definieren.
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
    // Ihre weiteren Providers
  ],
};
```

In `app/app.server.config.ts` (Server-Seite):

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