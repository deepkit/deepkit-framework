# Broker 总线

Deepkit 消息总线是一种消息总线系统（发布/订阅，分布式事件系统），它允许你在应用的不同部分之间发送消息或事件。

它可用于微服务、单体或任何其他类型的应用。非常适合事件驱动架构。  

它不同于 Deepkit 事件系统，后者用于进程内事件。Broker 总线用于需要发送到其他进程或服务器的事件。当你希望在由 FrameworkModule 自动启动的多个 worker 之间通信时，Broker 总线也非常适合，例如 `new FrameworkModule({workers: 4})`。

该系统旨在保持类型安全，并会自动序列化与反序列化消息（使用 BSON）。如果你为消息类型添加了[验证](../runtime-types/validation.md)，它还会在发送前和接收后验证消息。这确保消息始终具有正确的格式并包含预期的数据。

## 用法

```typescript
import { BrokerBus } from '@deepkit/broker';

const bus = new BrokerBus(adapter);

// 将此类型移动到共享文件
type UserEvent = { type: 'user-created', id: number } | { type: 'user-deleted', id: number };

const channel = bus.channel<Events>('user-events');

await channel.subscribe((event) => {
  if (event.type === 'user-created') {
    console.log('User created', event.id);
  } else if (event.type === 'user-deleted') {
    console.log('User deleted', event.id);
  }
});

await channel.publish({ type: 'user-created', id: 1 });
```

通过为通道定义名称和类型，你可以确保只发送和接收正确类型的消息。
数据会被自动序列化与反序列化（使用 BSON）。

## 在应用中使用

一个在你的应用中使用 BrokerBus 的完整示例。
如果你导入 `FrameworkModule`，该类会自动在依赖注入容器中可用。
有关更多信息，请参阅入门页面。

### Subject

发送和监听消息的默认方式是使用 rxjs 的 `Subject` 类型。它的 `subscribe` 和 `next` 方法使你能够以类型安全的方式发送和接收消息。所有 Subject 实例都由代理管理，一旦该 Subject 被垃圾回收，其订阅将从代理后端（例如 Redis）中移除。

覆盖 BrokerBus 的 `BusBrokerErrorHandler` 以处理发布或订阅消息时的失败。

这种方法很好地将你的业务代码与代理服务器解耦，并允许你在没有代理服务器的测试环境中使用相同的代码。

```typescript
import { BrokerBus, BrokerBusChannel, provideBusSubject } from '@deepkit/broker';
import { FrameworkModule } from '@deepkit/framework';
import { Subject } from 'rxjs';

// 将此类型移动到共享文件
type MyChannel = Subject<{
    id: number;
    name: string;
}>;

class Service {
    // MyChannel 不是单例，而是为每个请求创建一个新实例。
    // 其生命周期由框架监控，一旦该 subject 被垃圾回收， 
    // 订阅将从代理后端（例如 Redis）中移除。
    constructor(private channel: MyChannel) {
        this.channel.subscribe((message) => {
            console.log('received message', message);
        });
    }

    update() {
        this.channel.next({ id: 1, name: 'Peter' });
    }
}

@rpc.controller('my-controller')
class MyRpcController {
    constructor(private channel: MyChannel) {
    }

    @rpc.action()
    getChannelData(): MyChannel {
        return this.channel;
    }
}

const app = new App({
    controllers: [MyRpcController],
    providers: [
        Service,
        provideBusSubject<MyChannel>('my-channel'),
    ],
    imports: [
        new FrameworkModule(),
    ],
});
```

### 总线通道 

如果你需要确认消息已发送，并希望在每种情况下处理错误，可以使用 `BrokerBusChannel` 类型。它的 `subscribe` 和 `publish` 方法会返回一个 Promise。

```typescript
import { BrokerBus, BrokerBusChannel, provideBusChannel } from '@deepkit/broker';
import { FrameworkModule } from '@deepkit/framework';

// 将此类型移动到共享文件
type MyChannel = BrokerBusChannel<{
    id: number;
    name: string;
}>;

class Service {
    constructor(private channel: MyChannel) {
        this.channel.subscribe((message) => {
            console.log('received message', message);
        }).catch(e => {
            console.error('Error while subscribing', e);
        });
    }

    async update() {
        await this.channel.publish({ id: 1, name: 'Peter' });
    }
}

const app = new App({
    providers: [
        Service,
        provideBusChannel<MyChannel>('my-channel'),
    ],
    imports: [
        new FrameworkModule(),
    ],
});
```