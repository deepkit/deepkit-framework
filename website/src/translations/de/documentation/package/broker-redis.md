# API `@deepkit/broker-redis`

```sh
npm install @deepkit/broker-redis
```

Stellt eine Redis-basierte Implementierung des Deepkit Brokers bereit. Dabei wird ioredis unter der Haube verwendet.

Dieser Adapter implementiert nicht den Queue-Adapter des Deepkit Brokers.

```typescript
import { BrokerKeyValue, BrokerBus } from '@deepkit/broker';
import { BrokerRedisAdapter } from '@deepkit/broker-redis';
import { ConsoleLogger } from '@deepkit/logger';

const adapter = new RedisBrokerAdapter({
    preifx: 'myapp:',
    host: 'localhost',
    port: 6379,
    // Optional, falls der Redis-Server eine Authentifizierung erfordert
    // db: 0, // Optional, um eine andere Redis-Datenbank anzugeben
}, new ConsoleLogger());

const keyValye = new BrokerKeyValue(adapter);
const bus = new BrokerBus(adapter);
// ...
```

<api-docs package="@deepkit/broker-redis"></api-docs>