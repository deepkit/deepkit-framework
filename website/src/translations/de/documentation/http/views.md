# HTML-Views

Deepkit HTTP kommt mit einem integrierten HTML-View-Rendering-System. Es basiert auf JSX und ermöglicht es, Views in TypeScript zu schreiben. Es ist keine Template-Engine mit eigener Syntax, sondern ein vollwertiger TypeScript/JSX-Renderer.

Es optimiert den JSX-Code zur Laufzeit und speichert das Ergebnis im Cache. Es ist daher sehr schnell und hat nahezu keinen Overhead.


## JSX

JSX ist eine Syntaxerweiterung für JavaScript und wird von TypeScript standardmäßig unterstützt. Es ermöglicht, HTML in TypeScript zu schreiben. Es ist sehr ähnlich zu Vue.js oder React.js.

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