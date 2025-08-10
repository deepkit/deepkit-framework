# Deepkit API 控制台

```bash
npms install @deepkit/api-console-module
```

HTTP 和 RPC API 的自动文档，以 TypeScript 类型语法展示所有路由、操作、参数、返回类型、状态码。

它是 [框架调试器](../framework.md) 的一部分，但也可以单独使用。

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

默认情况下，`new ApiConsoleModule` 会显示所有 HTTP 和 RPC 路由。你也可以通过 `ApiConsoleModule` 类上的方法指定要显示的路由。

<app-images>
<app-image src="/assets/screenshots/api-console-http-get.png"></app-image>
<app-image src="/assets/screenshots/api-console-http-post.png"></app-image>
<app-image src="/assets/screenshots/api-console-overview.png"></app-image>
<app-image src="/assets/screenshots/api-console-overview-detail.png"></app-image>
<app-image src="/assets/screenshots/api-console-overview-detail-get.png"></app-image>
</app-images>

<api-docs package="@deepkit/api-console-module"></api-docs>