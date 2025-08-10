# API `@deepkit/broker-redis`

```sh
npm install @deepkit/broker-redis
```

Deepkit Broker의 Redis 기반 구현을 제공합니다. 내부적으로 ioredis를 사용합니다.

이 adapter는 Deepkit Broker의 queue adapter를 구현하지 않습니다.

```typescript
import { BrokerKeyValue, BrokerBus } from '@deepkit/broker';
import { BrokerRedisAdapter } from '@deepkit/broker-redis';
import { ConsoleLogger } from '@deepkit/logger';

const adapter = new RedisBrokerAdapter({
    preifx: 'myapp:',
    host: 'localhost',
    port: 6379,
    // password: 'your-password', // 선택 사항, Redis 서버에서 인증이 필요한 경우
    // db: 0, // 선택 사항, 다른 Redis 데이터베이스를 지정하려는 경우
}, new ConsoleLogger());

const keyValye = new BrokerKeyValue(adapter);
const bus = new BrokerBus(adapter);
// ...
```

<api-docs package="@deepkit/broker-redis"></api-docs>