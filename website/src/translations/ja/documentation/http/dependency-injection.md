# 依存性注入

ルーターの関数、コントローラクラス、およびコントローラーメソッドは任意の依存関係を定義でき、これらは依存性注入コンテナによって解決されます。たとえば、データベース抽象化やロガーに簡便にアクセスできます。

たとえば、データベースがプロバイダとして登録されていれば、注入できます:

```typescript
class Database {
    //...
}

const app = new App({
    providers: [
        Database,
    ],
});
```

_関数API:_

```typescript
router.get('/user/:id', async (id: number, database: Database) => {
    return await database.query(User).filter({id}).findOne();
});
```

_コントローラAPI:_

```typescript
class UserController {
    constructor(private database: Database) {}

    @http.GET('/user/:id')
    async userDetail(id: number) {
        return await this.database.query(User).filter({id}).findOne();
    }
}

//あるいはメソッド内に直接
class UserController {
    @http.GET('/user/:id')
    async userDetail(id: number, database: Database) {
        return await database.query(User).filter({id}).findOne();
    }
}
```

詳細は [依存性注入](dependency-injection) を参照してください。

## スコープ

すべてのHTTPコントローラと関数ルートは、`http` 依存性注入スコープ内で管理されます。HTTPコントローラは各HTTPリクエストごとにインスタンス化されます。これは、両者が `http` スコープに登録されたプロバイダにアクセスできることも意味します。さらに、`@deepkit/http` の `HttpRequest` と `HttpResponse` を依存関係として利用できます。deepkit フレームワークを使用している場合は、`@deepkit/framework` の `SessionHandler` も利用可能です。

```typescript
import { HttpResponse } from '@deepkit/http';

router.get('/user/:id', (id: number, request: HttpRequest) => {
});

router.get('/', (response: HttpResponse) => {
    response.end('Hello');
});
```

各HTTPリクエストごとにサービスをインスタンス化するなどの目的で、プロバイダを `http` スコープに配置すると便利な場合があります。HTTPリクエストの処理が完了すると、`http` スコープのDIコンテナは削除され、その結果、すべてのプロバイダインスタンスはガベージコレクタ（GC）の対象となりクリーンアップされます。

`http` スコープにプロバイダを配置する方法については [依存性注入のスコープ](dependency-injection.md#di-scopes) を参照してください。