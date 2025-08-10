# HTTP

处理 HTTP 请求是服务器最为人所知的任务之一。它将输入（HTTP 请求）转换为输出（HTTP 响应）并执行特定任务。客户端可以通过多种方式在 HTTP 请求中向服务器发送数据，服务器必须正确读取并处理这些数据。除了 HTTP body，还可以通过 HTTP query 或 HTTP header 传递值。数据实际如何处理取决于服务器，由服务器定义客户端应当将这些值发送到哪里以及以何种方式发送。

这里的首要任务不仅是正确执行用户所期望的操作，还要正确转换（反序列化）并验证来自 HTTP 请求的任何输入。

HTTP 请求在服务器上经过的流水线可以多种多样且复杂。许多简单的 HTTP 库在给定路由中只传递 HTTP 请求和 HTTP 响应，并期望开发者直接处理 HTTP 响应。中间件 API 允许按需扩展这条流水线。

_Express 示例_

```typescript
const http = express();
http.get('/user/:id', (request, response) => {
    response.send({id: request.params.id, username: 'Peter' );
});
```

这非常适合简单用例，但随着应用程序的增长会很快变得混乱，因为所有输入和输出都必须手动序列化或反序列化并进行验证。同时，还必须考虑如何从应用本身获取诸如数据库抽象之类的对象和服务。这迫使开发者在其之上构建一层架构来映射这些必需的功能。

相反，Deepkit 的 HTTP 库利用了 TypeScript 和依赖注入的力量。基于定义的类型，任何值的序列化/反序列化与验证都会自动进行。它还允许像上面的示例那样通过函数式 API 定义路由，或通过控制器类定义路由，以满足不同架构的需求。

它既可以与现有的 HTTP 服务器一起使用（如 Node 的 `http` 模块），也可以与 Deepkit 框架一起使用。两种 API 变体都可以访问依赖注入容器，从而方便地从应用中获取诸如数据库抽象和配置等对象。

## 示例：函数式 API

```typescript
import { Positive } from '@deepkit/type';
import { http, HttpRouterRegistry } from '@deepkit/http';
import { FrameworkModule } from "@deepkit/framework";

//函数式 API
const app = new App({
    imports: [new FrameworkModule()]
});
const router = app.get(HttpRouterRegistry);

router.get('/user/:id', (id: number & Positive, database: Database) => {
    //id 保证为 number 类型且为正数。
    //database 由 DI 容器注入。
    return database.query(User).filter({ id }).findOne();
});

app.run();
```

## 类控制器 API

```typescript
import { Positive } from '@deepkit/type';
import { http, HttpRouterRegistry } from '@deepkit/http';
import { FrameworkModule } from "@deepkit/framework";
import { User } from "discord.js";

//控制器 API
class UserController {
    constructor(private database: Database) {
    }

    @http.GET('/user/:id')
    user(id: number & Positive) {
        return this.database.query(User).filter({ id }).findOne();
    }
}

const app = new App({
    controllers: [UserController],
    imports: [new FrameworkModule()]
});
```