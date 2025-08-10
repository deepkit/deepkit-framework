# Deepkit Broker

Deepkit Broker 是一个针对消息队列、消息总线、事件总线、发布/订阅、键值存储、缓存以及原子操作的高性能抽象。它以类型安全为核心，具备自动序列化与验证、高性能和可扩展性。

Deepkit Broker 同时是客户端和服务器。它可以作为独立服务器使用，或作为客户端连接到其他 Deepkit Broker 服务器。它被设计用于微服务架构，也可以用于单体应用。

客户端使用适配器模式以支持不同的后端。你可以用相同的代码在不同后端之间切换，甚至可以同时使用多个后端。

目前有 3 个可用适配器。一个是默认的 `BrokerDeepkitAdapter`，它与 Deepkit Broker 服务器通信，并随 Deepkit Broker 开箱即用（包括服务器）。
第二个是位于 [@deepkit/broker-redis](./package/broker-redis) 的 `BrokerRedisAdapter`，它与 Redis 服务器通信。第三个是 `BrokerMemoryAdapter`，用于测试的内存适配器。

## 安装

使用 [Deepkit 框架](./framework.md) 时会默认安装并启用 Deepkit Broker。否则，可以通过以下方式安装：

```bash
npm install @deepkit/broker
```

## Broker 类

Deepkit Broker 提供以下主要的 broker 类：

- **BrokerCache** - 二级缓存（L2）抽象与缓存失效
- **BrokerBus** - 消息总线（发布/订阅）
- **BrokerQueue** - 队列系统
- **BrokerLock** - 分布式锁
- **BrokerKeyValue** - 键值存储

这些类通过接收一个 broker 适配器，以类型安全的方式与 broker 服务器通信。

```typescript
import { BrokerBus, BrokerMemoryAdapter } from '@deepkit/broker';

const bus = new BrokerBus(new BrokerMemoryAdapter());
const channel = bus.channel<{ foo: string }>('my-channel-name');
await channel.subscribe((message) => {
  console.log('received message', message);
});

await channel.publish({ foo: 'bar' });
```

FrameworkModule 提供并注册默认适配器并连接到 Deepkit Broker 服务器，该服务器默认在同一进程中运行。

借助运行时类型以及调用 `channel<Type>('my-channel-name');`，一切都是类型安全的，消息可在适配器中直接自动验证与序列化。
默认实现 `BrokerDeepkitAdapter` 会为你自动处理这些（并使用 BSON 进行序列化）。

请注意，每个 broker 类都有自己的适配器接口，因此你可以只实现所需的方法。`BrokerDeepkitAdapter` 实现了所有这些接口，可用于所有 broker API。

## 应用集成

要在使用依赖注入的 Deepkit 应用中使用这些类，可以使用 `FrameworkModule`，它提供以下内容：

- broker 服务器的默认适配器
- broker 服务器本身（并自动启动）
- 将所有 broker 类注册为提供者

`FrameworkModule` 会基于给定配置为已配置的 broker 服务器提供默认的 broker 适配器。
它还会为所有 broker 类注册提供者，因此你可以将它们（例如 BrokerBus）直接注入到你的服务和提供者工厂中。

```typescript
// 在单独文件中，例如 broker-channels.ts
type MyBusChannel = BrokerBusChannel<MyMessage>;

const app = new App({
  providers: [
    Service,
    provide<MyBusChannel>((bus: BrokerBus) => bus.channel<MyMessage>('my-channel-name')),
  ],
  imports: [new FrameworkModule({
    broker: {
      // 如果 startOnBootstrap 为 true，broker 服务器将启动在此地址。可以是 Unix 套接字路径或 host:port 组合
      listen: 'localhost:8811', // 或 'var/broker.sock';
      // 若要使用不同的 broker 服务器，这里是其地址。可以是 Unix 套接字路径或 host:port 组合。
      host: 'localhost:8811', //或 'var/broker.sock';
      // 在主进程中自动启动单个 broker。若有自定义 broker 节点，请禁用它。
      startOnBootstrap: true,
    },
  })],
});
```

然后你可以将派生的 broker 类（或直接使用 broker 类）注入到你的服务中：

```typescript
import { MyBusChannel } from './broker-channels.ts';

class Service {
  constructor(private bus: MyBusChannel) {
  }

  async addUser() {
    await this.bus.publish({ foo: 'bar' });
  }
}
```

为你的通道创建一个派生类型（如上所示的 `MyBusChannel`）通常是个好主意，这样你就可以轻松地将它们注入到服务中。
否则，你每次需要时都必须注入 `BrokerBus` 并调用 `channel<MyMessage>('my-channel-name')`，这既容易出错，也不符合 DRY 原则。

几乎所有 broker 类都支持这种派生方式，你可以在一个地方轻松定义并在各处使用。有关更多信息，请参阅相应的 broker 类文档。

## 自定义适配器

如果你需要自定义适配器，可以通过实现 `@deepkit/broker` 中以下接口之一或多个来创建自己的适配器：

```typescript
export type BrokerAdapter = BrokerAdapterCache & BrokerAdapterBus & BrokerAdapterLock & BrokerAdapterQueue & BrokerAdapterKeyValue;
```

```typescript
import { BrokerAdapterBus, BrokerBus, Release } from '@deepkit/broker';
import { Type } from '@deepkit/type';

class MyAdapter implements BrokerAdapterBus {
  disconnect(): Promise<void> {
    // 实现：从 broker 服务器断开连接
  }
  async publish(name: string, message: any, type: Type): Promise<void> {
    // 实现：向 broker 服务器发送消息，name 为 'my-channel-name'，message 为 { foo: 'bar' }
  }
  async subscribe(name: string, callback: (message: any) => void, type: Type): Promise<Release> {
    // 实现：订阅 broker 服务器，name 为 'my-channel-name'
  }
}

// 或使用默认适配器 BrokerDeepkitAdapter
const adapter = new MyAdapter;
const bus = new BrokerBus(adapter);

```

## Broker 服务器

默认情况下，一旦引入 `FrameworkModule` 并运行 `server:start` 命令，Broker 服务器就会自动启动。
所有 Broker 类默认都配置为连接到该服务器。

在生产环境中，你通常会在单独的进程或不同的机器上运行 broker 服务器。
你会使用 `server:broker:start` 来启动 broker 服务器，而不是 `server:start`。

如果你的流量很大并且需要扩展性，应该改用 [Redis 适配器](./package/broker-redis.md)。它的设置更复杂，
因为你需要运行一个 Redis 服务器，但性能更好，可以处理更多的流量。

```bash
ts-node app.ts server:broker:start
```

这会在（例如通过 `new FrameworkModule({broker: {listen: 'localhost:8811'}})`）配置的地址上启动服务器。
如果启用了 `app.loadConfigFromEnv({prefix: 'APP_', namingStrategy: 'upper'});`，你也可以通过环境变量修改地址：

```bash
APP_FRAMEWORK_BROKER_LISTEN=localhost:8811 ts-node app.ts server:broker:start
```

如果你手动启动服务器，请确保在应用配置中通过 `startOnBootstrap: false` 禁用自动启动 broker 服务器。