# API `@deepkit/broker-redis`

```sh
npm install @deepkit/broker-redis
```

提供 Deepkit Broker 的基于 Redis 的实现。其底层使用 ioredis。

此适配器不实现 Deepkit Broker 的队列适配器功能。

```typescript
import { BrokerKeyValue, BrokerBus } from '@deepkit/broker';
import { BrokerRedisAdapter } from '@deepkit/broker-redis';
import { ConsoleLogger } from '@deepkit/logger';

const adapter = new RedisBrokerAdapter({
    preifx: 'myapp:',
    host: 'localhost',
    port: 6379,
    // password: 'your-password', // 可选项，如果你的 Redis 服务器需要身份验证
    // db: 0, // 可选项，用于指定不同的 Redis 数据库
}, new ConsoleLogger());

const keyValye = new BrokerKeyValue(adapter);
const bus = new BrokerBus(adapter);
// ...
```

<api-docs package="@deepkit/broker-redis"></api-docs>