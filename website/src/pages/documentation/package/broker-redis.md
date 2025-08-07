# API `@deepkit/broker-redis`

```sh
npm install @deepkit/broker-redis
```

Provides a Redis-based implementation of the Deepkit Broker. This uses ioredis under the hood.

This adapter does not implement the queue adapter of Deepkit Broker.

```typescript
import { BrokerKeyValue, BrokerBus } from '@deepkit/broker';
import { BrokerRedisAdapter } from '@deepkit/broker-redis';
import { ConsoleLogger } from '@deepkit/logger';

const adapter = new RedisBrokerAdapter({
    preifx: 'myapp:',
    host: 'localhost',
    port: 6379,
    // password: 'your-password', // Optional, if your Redis server requires authentication
    // db: 0, // Optional, to specify a different Redis database
}, new ConsoleLogger());

const keyValye = new BrokerKeyValue(adapter);
const bus = new BrokerBus(adapter);
// ...
```

<api-docs package="@deepkit/broker-redis"></api-docs>
