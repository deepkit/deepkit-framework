# HTML ビュー

Deepkit HTTP には組み込みの HTML ビュー描画システムが付属しています。これは JSX を基盤としており、ビューを TypeScript で記述できます。独自の構文を持つテンプレートエンジンではなく、完全な TypeScript/JSX レンダラーです。

実行時に JSX コードを最適化し、結果をキャッシュします。そのため非常に高速で、ほとんどオーバーヘッドがありません。


## JSX

JSX は JavaScript の構文拡張で、TypeScript を標準でサポートしています。TypeScript で HTML を記述できます。Vue.js や React.js に非常によく似ています。

```tsx app=app.ts
import { App } from '@deepkit/app';
import { HttpRouterRegistry } from "@deepkit/http";

export function View() {
    return <div>
        <h1>Hello World</h1>
        <p>My first JSX view</p>
    </div>;
}

const app = new App({});
const router = app.get(HttpRouterRegistry);

router.get('/', () => <View/>);

app.run();
```

```sh
```