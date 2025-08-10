# Deepkit API Console

```bash
npms install @deepkit/api-console-module
```

Automatische Dokumentation der HTTP- und RPC-API, die alle routes, actions, parameters, return types und status codes in TypeScript type syntax anzeigt.

Es ist Teil des [Framework Debugger](../framework.md), kann aber auch eigenständig verwendet werden.

```typescript
import { ApiConsoleModule } from '@deepkit/api-console-module';

new App({
    imports: [
        new ApiConsoleModule({
            path: '/api',
            markdown: `
        # Meine API
        
        Dies ist meine API-Dokumentation.
        
        Viel Spaß!
        `
        }),
    ]
})
```

Standardmäßig zeigt `new ApiConsoleModule` alle HTTP- und RPC-routes an. Sie können außerdem festlegen, welche routes angezeigt werden sollen, indem Sie die Methoden der `ApiConsoleModule` Class verwenden.

<app-images>
<app-image src="/assets/screenshots/api-console-http-get.png"></app-image>
<app-image src="/assets/screenshots/api-console-http-post.png"></app-image>
<app-image src="/assets/screenshots/api-console-overview.png"></app-image>
<app-image src="/assets/screenshots/api-console-overview-detail.png"></app-image>
<app-image src="/assets/screenshots/api-console-overview-detail-get.png"></app-image>
</app-images>

<api-docs package="@deepkit/api-console-module"></api-docs>