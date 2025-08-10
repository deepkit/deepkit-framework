# HTML 뷰

Deepkit HTTP에는 내장 HTML 뷰 렌더링 시스템이 포함되어 있습니다. 이는 JSX 기반이며, 뷰를 TypeScript로 작성할 수 있게 해줍니다. 자체 문법을 가진 템플릿 엔진이 아니라, 완전한 TypeScript/JSX 렌더러입니다.

런타임에 JSX 코드를 최적화하고 결과를 캐시합니다. 따라서 매우 빠르며 오버헤드가 거의 없습니다.


## JSX

JSX는 JavaScript의 문법 확장이며, 기본적으로 TypeScript 지원을 제공합니다. TypeScript에서 HTML을 작성할 수 있게 해줍니다. Vue.js 또는 React.js와 매우 유사합니다.

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