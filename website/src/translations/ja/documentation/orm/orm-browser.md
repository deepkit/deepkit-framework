# ORM ブラウザ

Deepkit ORM Browser は、データベースのスキーマとデータを探索するための Web ベースのツールです。Deepkit Framework の上に構築されており、Deepkit ORM がサポートする任意のデータベースで使用できます。

![ORM ブラウザ](/assets/screenshots-orm-browser/content-editing.png)

## インストール

Deepkit ORM Browser は Deepkit Framework の一部で、デバッグモードが有効な場合に有効になります。

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

また、Deepkit ORM Browser をスタンドアロンのパッケージとしてインストールすることもできます。

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

次に、Deepkit ORM Browser サーバーを起動できます。

```sh
./node_modules/.bin/deepkit-orm-browser database.ts
```

これで Deepkit ORM Browser は http://localhost:9090 で利用できます。