# RPC

RPC（Remote Procedure Call，远程过程调用）使得远程服务器上的函数可以像本地函数一样被调用。与使用 HTTP 方法和 URL 进行映射的 HTTP 客户端-服务器通信不同，RPC 使用函数名进行映射。要发送的数据以普通函数参数的形式传递，服务器上函数调用的结果再发送回客户端。

RPC 的优点是客户端-服务器抽象较为轻量，因为它不涉及处理请求头、URL、查询字符串等。缺点是，通过 RPC 暴露的服务器函数不易被浏览器直接调用，通常需要特定的客户端。

RPC 的一个关键特性是客户端与服务器之间的数据会被自动序列化与反序列化。因此，通常可以实现类型安全的 RPC 客户端。一些 RPC 框架要求用户以特定格式提供类型（参数类型与返回类型）。这可能采用 DSL 的形式，例如 gRPC 的 Protocol Buffers、GraphQL，或 JavaScript 的 schema 构建器。RPC 框架也可能提供额外的数据校验，但并非所有框架都支持。

Deepkit RPC 能从 TypeScript 代码本身提取类型，因此无需使用代码生成器或手动定义。Deepkit 支持对参数与结果的自动序列化和反序列化。一旦在 Validation 中定义了额外的约束，它们会被自动校验。这使得通过 RPC 的通信具有极高的类型安全性与效率。Deepkit RPC 对基于 `rxjs` 的流式处理的支持，使其成为实时通信的理想工具。

为说明 RPC 背后的概念，请看以下代码：

```typescript
//server.ts
class Controller {
    hello(title: string): string {
        return 'Hello ' + title
    }
}
```

类似 hello 的方法在服务器端的类中与普通函数一样实现，可被远程客户端调用。

```typescript
//client.ts
const client = new RpcClient('localhost');
const controller = client.controller<Controller>();

const result = await controller.hello('World'); // => 'Hello World';
```

由于 RPC 本质上基于异步通信，通信通常通过 HTTP 进行，也可以通过 TCP 或 WebSocket。这意味着在 TypeScript 中，所有函数调用都会被转换为 `Promise`。结果可通过相应的 `await` 异步获取。

## 同构 TypeScript

当一个项目在客户端（通常为前端）与服务器端（后端）同时使用 TypeScript 时，称为同构 TypeScript。基于 TypeScript 类型的类型安全 RPC 框架对这类项目尤为有益，因为类型可以在客户端与服务器端之间共享。

为此，应将两端共用的类型抽取到单独的文件或包中。在各自的一端引入这些类型即可将其组合起来。

```typescript
//shared.ts
export class User {
    id: number;
    username: string;
}

//server.ts
import { User } from './shared';

@rpc.controller('/user')
class UserController  {
    async getUser(id: number): Promise<User> {
        return await datbase.query(User).filter({id}).findOne();
    }
}

//client.ts
import { UserControllerApi } from './shared';
import type { UserController } from './server.ts'
const controller = client.controller<UserController>('/user');
const user = await controller.getUser(2); // => User
```

向后兼容可与普通本地 API 一样实现：要么将新参数标记为可选，要么添加一个新方法。