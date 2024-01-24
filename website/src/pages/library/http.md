---
title: Deepkit HTTP
package: '@deepkit/http'
doc: http/getting-started
api: http
category: http
---

<p class="introduction">
    Deepkit HTTP is a high-performance HTTP router with built-in dependency injection, routing, and validation support.
</p>

## Features

<div class="app-boxes-small">
    <box title="Runtime Types">Use just regular TypeScript for RPC functions definition.</box>
    <box title="Validation">Built-In validation for parameters using just TypeScript types.</box>
    <box title="Dependency Injection">Full fledged dependency injection for classes and even functions.</box>
    <box title="Event System">Powerful event system to hook into the HTTP request handling.</box>
    <box title="Middleware">Register global middleware for all routes or specific routes.</box>
    <box title="JSX Views">Use JSX to render views in a performant way.</box>
    
</div>

<feature class="center">

## Routes

Write HTTP routes with class methods or simple async functions.

```typescript title=class-routes.ts
import { App } from '@deepkit/app';
import { FrameworkModule } from '@deepkit/framework';
import { http } from '@deepkit/http';

class MyPage {
  @http.GET('/')
  helloWorld() {
    return 'Hello World!';
  }
}

new App({
  controllers: [MyPage],
  imports: [new FrameworkModule()],
}).run();
```

```typescript title=functional-routes.ts
import { App } from '@deepkit/app';
import { FrameworkModule } from '@deepkit/framework';
import { HttpRouterRegistry } from '@deepkit/http';

const app = new App({
  imports: [new FrameworkModule()],
});

const router = app.get(HttpRouterRegistry);

router.get('/', () => {
  return 'Hello World!';
});

app.run();
```

</feature>
