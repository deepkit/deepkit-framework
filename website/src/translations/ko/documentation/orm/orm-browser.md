# ORM 브라우저

Deepkit ORM Browser는 데이터베이스 스키마와 데이터를 탐색하기 위한 웹 기반 도구입니다. Deepkit Framework 위에 구축되었으며, Deepkit ORM에서 지원하는 모든 데이터베이스와 함께 사용할 수 있습니다.

![ORM 브라우저](/assets/screenshots-orm-browser/content-editing.png)

## 설치

Deepkit ORM Browser는 Deepkit Framework의 일부이며 debug 모드가 활성화되면 함께 활성화됩니다.

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

또는, Deepkit ORM Browser를 독립 패키지로 설치할 수 있습니다.

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

다음으로, Deepkit ORM Browser 서버를 시작할 수 있습니다.

```sh
./node_modules/.bin/deepkit-orm-browser database.ts
```

이제 http://localhost:9090에서 Deepkit ORM Browser를 사용할 수 있습니다.