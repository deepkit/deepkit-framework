# HTML Views

Deepkit HTTP comes with a built-in HTML view rendering system. It's based on JSX and allows you to write your views in TypeScript. It's not a template engine with its own syntax, but a full-fledged TypeScript/JSX renderer.

It optimises the JSX code at runtime and caches the result. It's therefore very fast and has almost no overhead.

## JSX

JSX is a syntax extension to JavaScript and comes with TypeScript support out of the box. It allows you to write HTML in TypeScript. It's very similar to Vue.js or React.js.

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
