# ORM Browser

Deepkit ORM Browser is a web-based tool to explore your database schema and data. It is built on top of the Deepkit Framework and can be used with any database supported by the Deepkit ORM.

![ORM Browser](/assets/screenshots-orm-browser/content-editing.png)

## Installation

Deepkit ORM Browser is part of the Deepkit Framework and enabled when debug mode is enabled.

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

Alternatively, you can install Deepkit ORM Browser as a standalone package.

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

Next, Deepkit ORM Browser server can be started.

```sh
./node_modules/.bin/deepkit-orm-browser database.ts
```

Deepkit ORM Browser is now available at http://localhost:9090.

