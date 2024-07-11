# Broker Atomic Locks

Deepkit Broker Locks is a simple way to create atomic locks across multiple processes or machines. 

It's a simple way to ensure that only one process can execute a certain code block at a time.

## Usage

```typescript
import { BrokerLock } from '@deepkit/broker';

const lock = new BrokerLock(adapter);

// lock is alive for 60 seconds.
// acquisition timeout is 10 seconds.
const myLock = lock.item('my-lock', { ttl: '60s', timeout: '10s' });

async function criticalSection() {
  // Holds the lock until the function is done.
  // cleans up the lock automatically, even if the function throws an error.
  await using hold = await lock1.hold();
}
```

The lock supports [Explicit Resource Management](https://github.com/tc39/proposal-explicit-resource-management), which means you don't have to use a try-catch block to ensure the lock is released properly.

To manually acquire and release a lock, you can use the `acquire` and `release` methods.

```typescript
// this blocks until the lock is acquired.
// or throws if timeout is reached
await myLock.acquire();

try {
  // do something critical
} finally {
  await myLock.release();
}
```

## App Usage

A full example of how to use the BrokerLock in your application.
The class is automatically available in the dependency injection container if you import the `FrameworkModule`.
See the Getting started page for more information.

```typescript
import { BrokerLock, BrokerLockItem } from '@deepkit/broker';
import { FrameworkModule } from '@deepkit/framework';

// move this type to a shared file
type MyCriticalLock = BrokerLockItem;

class Service {
  constructor(private criticalLock: MyCriticalLock) {
  }

  async doSomethingCritical() {
    await using hold = await this.criticalLock.hold();
    
    // do something critical,
    // lock is released automatically
  }
}

const app = new App({
  providers: [
    Service,
    provide<MyCriticalLock>((lock: BrokerLock) => lock.item('my-critical-lock', { ttl: '60s', timeout: '10s' })),
  ],
  imports: [
    new FrameworkModule(),
  ],
});
```


