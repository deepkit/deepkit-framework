# Broker 缓存

Deepkit Broker Cache 类是一个多级（2 级）缓存，它在内存中保留易失性的本地缓存，只有当数据不在缓存中、已过期或被失效时，才会从 broker 服务器获取数据。这样可以在数据获取时实现非常高的性能和低延迟。

该缓存被设计为类型安全，并会自动（使用 BSON）序列化和反序列化数据。它还支持缓存失效与清理。该实现确保在每个进程中，即使有多个请求同时尝试访问同一缓存项，缓存也只会重建一次。

数据不会持久化到服务器，仅保存在内存中。若服务器重启，所有数据都会丢失。

## 用法

请务必阅读入门页面，以了解如何正确设置应用，使 BrokerCache 在依赖注入容器中可用。

Deepkit Broker 中的缓存抽象与简单的键/值存储截然不同。它通过定义一个缓存名称和一个构建器函数工作：当缓存为空或过期时，会自动调用该函数。该构建器函数负责构建随后存储到缓存中的数据。

```typescript
import { BrokerCache, BrokerCacheItem } from '@deepkit/broker';

const cache = new BrokerCache(adapter);

const cacheItem = cache.item('my-cache', async () => {
  // 当缓存为空或过期时会调用的构建器函数
  return 'hello world';
});


// 检查缓存是否过期或为空
await cacheItem.exists();

// 从缓存中获取数据，或从 broker 服务器获取。
// 如果缓存为空或过期，将调用构建器函数，
// 并返回结果，同时将结果发送到 broker 服务器。
const topUsers = await cacheItem.get();

// 使缓存失效，以便下一次调用 get() 时
// 再次调用构建器函数。
// 会清理本地缓存和服务器缓存。
await cacheItem.invalidate();

// 手动向缓存中设置数据
await cacheItem.set(xy);
```

## 在应用中的用法

一个在应用中使用 BrokerCache 的完整示例。
如果导入了 `FrameworkModule`，该类会自动在依赖注入容器中可用。
更多信息参见入门页面。

```typescript
import { BrokerCache, BrokerCacheItem } from '@deepkit/broker';
import { FrameworkModule } from '@deepkit/framework';

// 最好将这些类型定义在一个公共文件中，以便复用
// 并将它们注入到你的服务中
type MyCacheItem = BrokerCacheItem<User[]>;

function createMyCache(cache: BrokerCache, database: Database) {
  return cache.item<User[]>('top-users', async () => {
    // 当缓存为空或过期时会调用的构建器函数
    return await database.query(User)
      .limit(10).orderBy('score').find();
  });
}

class Service {
  constructor(private cacheItem: MyCacheItem) {
  }

  async getTopUsers() {
    return await this.cacheItem.get();
  }
}

const app = new App({
  providers: [
    Service,
    Database,
    provide<MyCacheItem>(createMyCache),
  ],
  imports: [
    new FrameworkModule(),
  ],
});

const cacheItem = app.get<MyCacheItem>();

// 从缓存中获取数据，或从 broker 服务器获取
const topUsers = await cacheItem.get();
```