# Deepkit API コンソール

```bash
npms install @deepkit/api-console-module
```

HTTP と RPC API の自動ドキュメント化。TypeScript の type 構文で、すべての routes、actions、parameters、return types、status codes を表示します。

これは [フレームワークデバッガー](../framework.md) の一部ですが、単体でも使用できます。

```typescript
import { ApiConsoleModule } from '@deepkit/api-console-module';

new App({
    imports: [
        new ApiConsoleModule({
            path: '/api',
            markdown: `
        # 私の API
        
        これは私の API ドキュメントです。
        
        お楽しみください！
        `
        }),
    ]
})
```

デフォルトでは `new ApiConsoleModule` はすべての HTTP および RPC routes を表示します。`ApiConsoleModule` Class の methods を使って、表示する routes を指定することもできます。

<app-images>
<app-image src="/assets/screenshots/api-console-http-get.png"></app-image>
<app-image src="/assets/screenshots/api-console-http-post.png"></app-image>
<app-image src="/assets/screenshots/api-console-overview.png"></app-image>
<app-image src="/assets/screenshots/api-console-overview-detail.png"></app-image>
<app-image src="/assets/screenshots/api-console-overview-detail-get.png"></app-image>
</app-images>

<api-docs package="@deepkit/api-console-module"></api-docs>