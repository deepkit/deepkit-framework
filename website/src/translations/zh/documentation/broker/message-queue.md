# Broker 队列

Deepkit Message Queue 是一个消息队列系统，它允许你将消息发送到队列服务器并由 worker 进行处理。

该系统设计为类型安全，并自动序列化和反序列化消息（使用 BSON）。

数据持久化在服务器上，因此即使服务器崩溃，数据也不会丢失。

## 使用

```typescript
import { BrokerQueue, BrokerQueueChannel } from '@deepkit/broker';

const queue = new BrokerQueue(adapter);

type User = { id: number, username: string };

const registrationChannel = queue.channel<User>('user/registered', {
  process: QueueMessageProcessing.exactlyOnce,
  deduplicationInterval: '1s',
});
```

```typescript
// 一个 worker 消费消息。
// 这通常在单独的进程中完成。
await registrationChannel.consume(async (user) => {
  console.log('User registered', user);
  // 如果 worker 在这里崩溃，消息不会丢失。
  // 它会自动重新投递给另一个 worker。
  // 如果这个回调未抛出错误就返回，该消息会被
  // 标记为已处理，并最终被移除。
});

// 应用程序发送消息
await registrationChannel.produce({ id: 1, username: 'Peter' });
```

## 在应用中的使用

一个在应用中如何使用 BrokerQueue 的完整示例。
如果你导入了 `FrameworkModule`，该类会自动在依赖注入容器中可用。
更多信息请参见“入门”页面。

为了最大化利用队列系统，建议启动多个 worker 来消费消息。
你会编写一个与主应用（可能有 http 路由等）不同的独立 `App`。

通过共享的应用模块共享通用服务。通道定义放在一个公共文件中，供应用的其余部分共享。

```typescript
// 文件：channels.ts

export type RegistrationChannel = BrokerQueueChannel<User>;
export const registrationChannelProvider = provide<RegistrationChannel>((queue: BrokerQueue) => queue.channel<User>('user/registered', {
  process: QueueMessageProcessing.exactlyOnce,
  deduplicationInterval: '1s',
}));
```

```typescript
// 文件：worker.ts
import { RegistrationChannel, registrationChannelProvider } from './channels';

async function consumerCommand(
  channel: RegistrationChannel, 
  database: Database) {

  await channel.consume(async (user) => {
    // 对该用户执行一些操作，
    // 例如存储信息、发送邮件等。
  });

  // 与 broker 的连接会保持进程存活。
}

const app = new App({
  providers: [
    Database,
    registrationChannelProvider,
  ],
  imports: [
    new FrameworkModule({}),
  ],
});

app.command('consumer', consumerCommand);

// 直接启动上面的 worker 命令
void app.run('consumer');
```

在你的应用中，你可以像这样生产消息：

```typescript
// 文件：app.ts
import { RegistrationChannel, registrationChannelProvider } from './channels';

class Service {
  constructor(private channel: RegistrationChannel) {
  }

  async registerUser(user: User) {
    await this.channel.produce(user);
  }
}

const app = new App({
  providers: [
    Service,
    registrationChannelProvider,
  ],
  imports: [
    new FrameworkModule({}),
  ],
});

void app.run();
```