# ORM 浏览器

Deepkit ORM 浏览器是一个基于 Web 的工具，用于探索你的数据库架构和数据。它构建在 Deepkit 框架之上，可用于 Deepkit ORM 支持的任何数据库。

![ORM 浏览器](/assets/screenshots-orm-browser/content-editing.png)

## 安装

Deepkit ORM 浏览器是 Deepkit 框架的一部分，并且在启用调试模式时会自动启用。

```typescript
import { App } from '@deepkit/app';
import { Database } from '@deepkit/orm';

class MyController {
    @http.GET('/')
    index() {
        return 'Hello World';
    }
}

class MainDatabase extends Database {
    constructor() {
        super(new DatabaseAdapterSQLite());
    }
}

new App({
    controllers: [MyController],
    providers: [MainDatabase],
    imports: [new FrameworkModule({debug: true})],
}).run();
```

或者，你可以将 Deepkit ORM 浏览器作为独立包安装。

```bash
npm install @deepkit/orm-browser
```

```typescript
// database.ts
import { Database } from '@deepkit/orm';

class MainDatabase extends Database {
    constructor() {
        super(new DatabaseAdapterSQLite());
    }
}

export const database = new MainDatabase();
```

接下来，可以启动 Deepkit ORM 浏览器服务器。

```sh
./node_modules/.bin/deepkit-orm-browser database.ts
```

现在可以通过 http://localhost:9090 访问 Deepkit ORM 浏览器。