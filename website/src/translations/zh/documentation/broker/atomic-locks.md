# Broker 原子锁

Deepkit Broker Locks 是一种在多个进程或机器之间创建原子锁的简单方法。 

它提供一种简单方式，确保同一时间只有一个进程可以执行某个代码块。

## 用法

```typescript
import { BrokerLock } from '@deepkit/broker';

const lock = new BrokerLock(adapter);

// 锁存活 60 秒。
// 获取超时时间为 10 秒。
const myLock = lock.item('my-lock', { ttl: '60s', timeout: '10s' });

async function criticalSection() {
  // 在函数执行完之前持有该锁。
  // 即使函数抛出错误，也会自动清理该锁。
  await using hold = await lock1.hold();
}
```

该锁支持[显式资源管理](https://github.com/tc39/proposal-explicit-resource-management)，这意味着你无需使用 try-catch 块来确保锁被正确释放。

要手动获取和释放锁，可以使用 `acquire` 和 `release` 方法。

```typescript
// 在获取到锁之前会阻塞。
// 若超过超时时间则抛出异常
await myLock.acquire();

try {
  // 执行关键操作
} finally {
  await myLock.release();
}
```

## 在应用中的用法

在你的应用中如何使用 BrokerLock 的完整示例。
如果导入 `FrameworkModule`，该类会自动在依赖注入容器中可用。
更多信息参见“入门”页面。

```typescript
import { BrokerLock, BrokerLockItem } from '@deepkit/broker';
import { FrameworkModule } from '@deepkit/framework';

// 将此类型移动到一个共享文件中
type MyCriticalLock = BrokerLockItem;

class Service {
  constructor(private criticalLock: MyCriticalLock) {
  }

  async doSomethingCritical() {
    await using hold = await this.criticalLock.hold();
    
    // 执行关键操作，
    // 锁会自动释放
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