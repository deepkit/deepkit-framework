# API `@deepkit/broker-redis`

```sh
npm install @deepkit/broker-redis
```

Deepkit Broker の Redis ベースの実装を提供します。内部では ioredis を使用しています。

この adapter は Deepkit Broker の queue adapter を実装していません。

```typescript
import { BrokerKeyValue, BrokerBus } from '@deepkit/broker';
import { BrokerRedisAdapter } from '@deepkit/broker-redis';
import { ConsoleLogger } from '@deepkit/logger';

const adapter = new RedisBrokerAdapter({
    preifx: 'myapp:',
    host: 'localhost',
    port: 6379,
    // 任意。Redis サーバーが認証を必要とする場合
    // password: 'your-password', // Optional, if your Redis server requires authentication
    // 任意。別の Redis データベースを指定する場合
    // db: 0, // Optional, to specify a different Redis database
}, new ConsoleLogger());

const keyValye = new BrokerKeyValue(adapter);
const bus = new BrokerBus(adapter);
// ...
```

<api-docs package="@deepkit/broker-redis"></api-docs>