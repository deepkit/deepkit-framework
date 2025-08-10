# HTML 视图

Deepkit HTTP 自带一个内置的 HTML 视图渲染系统。它基于 JSX，并允许你用 TypeScript 编写视图。它不是拥有自己语法的模板引擎，而是一个功能完备的 TypeScript/JSX 渲染器。

它会在运行时优化 JSX 代码并缓存结果。因此速度非常快，几乎没有额外开销。


## JSX

JSX 是 JavaScript 的语法扩展，并且开箱即用地支持 TypeScript。它允许你在 TypeScript 中编写 HTML。它与 Vue.js 或 React.js 非常相似。

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