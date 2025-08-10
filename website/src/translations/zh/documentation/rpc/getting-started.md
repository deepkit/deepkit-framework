# 入门

要使用 Deepkit RPC，必须正确安装 `@deepkit/type`，因为它基于运行时类型。参见[运行时类型安装](../runtime-types.md)。

成功完成后，即可安装 `@deepkit/rpc`，或安装已在底层使用该库的 Deepkit 框架。

```sh
npm install @deepkit/rpc
```

请注意，`@deepkit/rpc` 中的控制器类基于 TypeScript 装饰器，必须启用 experimentalDecorators 功能。

如果服务器和客户端各自有自己的 package.json，则必须在二者上都安装 `@deepkit/rpc` 包。

若要通过 TCP 与服务器通信，必须在客户端和服务器上安装 `@deepkit/rpc-tcp` 包。

```sh
npm install @deepkit/rpc-tcp
```

对于 WebSocket 通信，该包同样需要在服务器上使用。另一方面，浏览器端客户端使用的是官方标准中的 WebSocket。

如果客户端还需要在不支持 WebSocket 的环境（例如 NodeJS）中使用，则客户端需要安装 ws 包。

```sh
npm install ws
```

## 用法

下面是一个基于 WebSocket 和 @deepkit/rpc 低级 API 的完整示例。在使用 Deepkit 框架时，控制器通过应用模块提供，而无需手动实例化 RpcKernel。

_文件：server.ts_

```typescript
import { rpc, RpcKernel } from '@deepkit/rpc';
import { RpcWebSocketServer } from '@deepkit/rpc-tcp';

@rpc.controller('/main')
export class Controller {
    @rpc.action()
    hello(title: string): string {
        return 'Hello ' + title;
    }
}

const kernel = new RpcKernel();
kernel.registerController(Controller);
const server = new RpcWebSocketServer(kernel, 'localhost:8081');
server.start({
    host: '127.0.0.1',
    port: 8081,
});
console.log('Server started at ws://127.0.0.1:8081');

```

_文件：client.ts_

```typescript
import { RpcWebSocketClient } from '@deepkit/rpc';
import type { Controller } from './server';

async function main() {
    const client = new RpcWebSocketClient('ws://127.0.0.1:8081');
    const controller = client.controller<Controller>('/main');

    const result = await controller.hello('World');
    console.log('result', result);

    client.disconnect();
}

main().catch(console.error);

```

## 服务器控制器

在远程过程调用（RPC）中，“Procedure”一词通常也称为“Action”。Action 是类中定义并使用 `@rpc.action` 装饰器标记的方法。类本身使用 `@rpc.controller` 装饰器标记为控制器并赋予唯一名称。该名称随后会在客户端中被引用，以定位到正确的控制器。可以按需定义并注册多个控制器。

```typescript
import { rpc } from '@deepkit/rpc';

@rpc.controller('/main');
class Controller {
    @rpc.action()
    hello(title: string): string {
        return 'Hello ' + title;
    }

    @rpc.action()
    test(): boolean {
        return true;
    }
}
```

只有标记为 `@rpc.action()` 的方法才能被客户端调用。

类型必须显式指定，不能通过推断获得。这一点很重要，因为序列化器需要确切知道类型的结构，才能将其转换为二进制数据（BSON）或 JSON，然后通过网络发送。

## 客户端控制器

在 RPC 的常规流程中，客户端可以在服务器上执行函数。但在 Deepkit RPC 中，服务器也可以在客户端上执行函数。为此，客户端也可以注册一个控制器。

待办

## 依赖注入

当使用 Deepkit 框架时，类由依赖注入容器实例化，从而自动可以访问应用中的所有其他提供者。

另请参见[依赖注入](dependency-injection.md#)。

## RxJS 流式处理

待办

## 名义类型

当客户端从函数调用中接收数据时，这些数据会先在服务器上序列化，然后在客户端反序列化。如果函数的返回类型包含类，这些类会在客户端被重建，但会丢失其名义身份和关联的方法。为了解决这个问题，请将这些类注册为具有唯一 ID/名称的名义类型。该方式应适用于 RPC-API 中使用的所有类。

要注册一个类，请使用装饰器 `@entity.name('id')`。

```typescript
import { entity } from '@deepkit/type';

@entity.name('user')
class User {
    id!: number;
    firstName!: string;
    lastName!: string;
    get fullName() {
        return this.firstName + ' ' + this.lastName;
    }
}
```

一旦该类被用作函数的返回结果，其身份将被保留。

```typescript
const controller = client.controller<Controller>('/main');

const user = await controller.getUser(2);
user instanceof User; //当使用了 @entity.name 时为 true，否则为 false
```