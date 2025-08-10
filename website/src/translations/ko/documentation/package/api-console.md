# Deepkit API Console

```bash
npms install @deepkit/api-console-module
```

HTTP 및 RPC API의 모든 routes, actions, parameters, return types, status codes를 TypeScript type syntax로 보여주는 자동 문서화.

이는 [Framework Debugger](../framework.md)의 일부이지만 독립적으로도 사용할 수 있습니다.

```typescript
import { ApiConsoleModule } from '@deepkit/api-console-module';

new App({
    imports: [
        new ApiConsoleModule({
            path: '/api',
            markdown: `
        # My API
        
        This is my API documentation.
        
        Have fun!
        `
        }),
    ]
})
```

기본적으로 `new ApiConsoleModule`은 모든 HTTP 및 RPC routes를 보여줍니다. 또한 `ApiConsoleModule` Class의 Method들을 사용하여 어떤 routes를 표시할지 지정할 수도 있습니다.

<app-images>
<app-image src="/assets/screenshots/api-console-http-get.png"></app-image>
<app-image src="/assets/screenshots/api-console-http-post.png"></app-image>
<app-image src="/assets/screenshots/api-console-overview.png"></app-image>
<app-image src="/assets/screenshots/api-console-overview-detail.png"></app-image>
<app-image src="/assets/screenshots/api-console-overview-detail-get.png"></app-image>
</app-images>

<api-docs package="@deepkit/api-console-module"></api-docs>