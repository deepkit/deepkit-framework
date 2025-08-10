# 依赖注入

路由函数、控制器类以及控制器方法都可以定义任意依赖，这些依赖由依赖注入容器解析。例如，可以方便地获取数据库抽象或日志记录器。

例如，如果将数据库作为提供者提供，则可以注入：

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

_函数式 API：_

```typescript
router.get('/user/:id', async (id: number, database: Database) => {
    return await database.query(User).filter({id}).findOne();
});
```

_控制器 API：_

```typescript
class UserController {
    constructor(private database: Database) {}

    @http.GET('/user/:id')
    async userDetail(id: number) {
        return await this.database.query(User).filter({id}).findOne();
    }
}

//或者直接在方法中
class UserController {
    @http.GET('/user/:id')
    async userDetail(id: number, database: Database) {
        return await database.query(User).filter({id}).findOne();
    }
}
```

参见[依赖注入](dependency-injection)了解更多。

## 作用域

所有 HTTP 控制器和函数式路由都在 `http` 依赖注入作用域中进行管理。HTTP 控制器会为每个 HTTP 请求相应实例化。这也意味着两者都可以访问注册在 `http` 作用域中的提供者。因此，来自 `@deepkit/http` 的 `HttpRequest` 和 `HttpResponse` 也可以作为依赖使用。如果使用 deepkit 框架，来自 `@deepkit/framework` 的 `SessionHandler` 也可用。

```typescript
import { HttpResponse } from '@deepkit/http';

router.get('/user/:id', (id: number, request: HttpRequest) => {
});

router.get('/', (response: HttpResponse) => {
    response.end('Hello');
});
```

在 `http` 作用域中放置提供者可能很有用，例如为每个 HTTP 请求实例化服务。一旦该 HTTP 请求处理完毕，`http` 作用域的 DI 容器就会被删除，其所有提供者实例也会由垃圾回收器（GC）清理。

参见[依赖注入作用域](dependency-injection.md#di-scopes)了解如何将提供者放入 `http` 作用域。