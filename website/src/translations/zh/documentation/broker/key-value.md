# Broker 键值存储

Deepkit Broker Key-Value 类是一个与 broker 服务器配合工作的简单键/值存储抽象。它提供了一种从 broker 服务器存储和检索数据的简单方式。

未实现本地缓存。所有 `get` 调用每次都会向 broker 服务器发起真实的网络请求。若要避免此情况，请使用 Broker Cache 抽象。

数据不会在服务器上持久化，只会保存在内存中。如果服务器重启，所有数据都会丢失。

## 用法

```typescript
import { BrokerKeyValue } from '@deepkit/broker';

const keyValue = new BrokerKeyValue(adapter, {
  ttl: '60s', // 每个键的生存时间。0 表示无 TTL（默认）。
});

const item = keyValue.item<number>('key1');

await item.set(123);
console.log(await item.get()); //123

await item.remove();
```

数据将根据给定的类型使用 BSON 自动序列化和反序列化。

方法 `set` 和 `get` 也可以直接在 `BrokerKeyValue` 实例上调用，
但缺点是你每次都需要传递键和类型。

```typescript
await keyValue.set<number>('key1', 123);
console.log(await keyValue.get<number>('key1')); //123
```

## 自增

`increment` 方法允许你以原子方式按给定数值增加某个键的值。

请注意，它会在服务器上创建自己的存储条目，并且与 `set` 或 `get` 不兼容。 

```typescript

const activeUsers = keyValue.item<number>('activeUsers');

// 以原子方式加 1
await activeUsers.increment(1);

await activeUsers.increment(-1);

// 获取当前值的唯一方式是以 0 调用 increment
const current = await activeUsers.increment(0);

// 移除该条目
await activeUsers.remove();
```

## 在应用中使用

一个在你的应用中使用 BrokerKeyValue 的完整示例。
如果导入 `FrameworkModule`，该类会自动在依赖注入容器中可用。
更多信息请参阅入门页面。

```typescript
import { BrokerKeyValue, BrokerKeyValueItem } from '@deepkit/broker';
import { FrameworkModule } from '@deepkit/framework';

// 将此类型移动到一个共享文件中
type MyKeyValueItem = BrokerKeyValueItem<User[]>;

class Service {
  constructor(private keyValueItem: MyKeyValueItem) {
  }

  async getTopUsers(): Promise<User[]> {
    // 可能为 undefined。你需要处理这种情况。
    // 如果你想避免这种情况，请使用 Broker Cache。
    return await this.keyValueItem.get();
  }
}

const app = new App({
  providers: [
    Service,
    provide<MyKeyValueItem>((keyValue: BrokerKeyValue) => keyValue.item<User[]>('top-users')),
  ],
  imports: [
    new FrameworkModule(),
  ],
});
```