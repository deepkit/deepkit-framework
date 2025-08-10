# 의존성 주입

router Function뿐만 아니라 controller Class와 controller Method도 임의의 의존성을 정의할 수 있으며, 이는 의존성 주입 컨테이너에 의해 해결됩니다. 예를 들어 database 추상화나 logger에 편리하게 접근할 수 있습니다.

예를 들어, database가 provider로 제공되어 있다면 주입할 수 있습니다:

```typescript
class Database {
    // ...
}

const app = new App({
    providers: [
        Database,
    ],
});
```

_함수형 API:_

```typescript
router.get('/user/:id', async (id: number, database: Database) => {
    return await database.query(User).filter({id}).findOne();
});
```

_컨트롤러 API:_

```typescript
class UserController {
    constructor(private database: Database) {}

    @http.GET('/user/:id')
    async userDetail(id: number) {
        return await this.database.query(User).filter({id}).findOne();
    }
}

// 또는 Method에서 직접
class UserController {
    @http.GET('/user/:id')
    async userDetail(id: number, database: Database) {
        return await database.query(User).filter({id}).findOne();
    }
}
```

자세한 내용은 [의존성 주입](dependency-injection)을 참조하세요.

## 스코프

모든 HTTP 컨트롤러와 함수형 Route는 `http` 의존성 주입 스코프 내에서 관리됩니다. HTTP 컨트롤러는 각 HTTP 요청마다 인스턴스화됩니다. 이는 둘 다 `http` 스코프에 등록된 provider에 접근할 수 있음을 의미합니다. 따라서 `@deepkit/http`의 `HttpRequest`와 `HttpResponse`도 의존성으로 사용할 수 있습니다. deepkit framework를 사용하는 경우 `@deepkit/framework`의 `SessionHandler`도 사용할 수 있습니다.

```typescript
import { HttpResponse } from '@deepkit/http';

router.get('/user/:id', (id: number, request: HttpRequest) => {
});

router.get('/', (response: HttpResponse) => {
    response.end('Hello');
});
```

각 HTTP 요청마다 서비스를 인스턴스화하기 위해 provider를 `http` 스코프에 배치하는 것이 유용할 수 있습니다. HTTP 요청이 처리되면 `http` 스코프의 DI 컨테이너는 삭제되며, 그에 따라 모든 provider 인스턴스가 가비지 컬렉터(GC)에서 정리됩니다.

`http` 스코프에 provider를 배치하는 방법은 [의존성 주입 스코프](dependency-injection.md#di-scopes)를 참조하세요.