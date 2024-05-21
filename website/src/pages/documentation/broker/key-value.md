# Broker Key-Value

Deepkit Broker Key-Value class is a simple key/value store abstraction that works with the broker server. It's a simple way to store and retrieve data from the broker server.

There is no local caching implemented. All `get` calls are real network requests to the broker server, every time. To avoid this, use the Broker Cache abstraction.

The data is not persisted on the server, but only kept in memory. If the server restarts, all data is lost.

## Usage

```typescript
import { BrokerKeyValue } from '@deepkit/broker';

const keyValue = new BrokerKeyValue(adapter, {
  ttl: '60s', // time to live for each key. 0 means no ttl (default).
});

const item = keyValue.item<number>('key1');

await item.set(123);
console.log(await item.get()); //123

await item.remove();
```

The data is automatically serialized and deserialized using BSON based on the given type.

The methods `set` and `get` can also be called directly on the `BrokerKeyValue` instance,
but has the disadvantage that you have to pass the key and type every time.

```typescript
await keyValue.set<number>('key1', 123);
console.log(await keyValue.get<number>('key1')); //123
```

## Increment

The `increment` method allows you to atomically increment the value of a key by a given amount.

Note that this creates its own storage entry on the server and is not compatible with `set` or `get`. 

```typescript

const activeUsers = keyValue.item<number>('activeUsers');

// Increment by 1 atomically
await activeUsers.increment(1);

await activeUsers.increment(-1);

// The only way to get the current value is to call increment with 0
const current = await activeUsers.increment(0);

// removes the entry
await activeUsers.remove();
```

## App Usage

A full example of how to use the BrokerKeyValue in your application.
The class is automatically available in the dependency injection container if you import the `FrameworkModule`.
See the Getting started page for more information.

```typescript
import { BrokerKeyValue, BrokerKeyValueItem } from '@deepkit/broker';
import { FrameworkModule } from '@deepkit/framework';

// move this type to a shared file
type MyKeyValueItem = BrokerKeyValueItem<User[]>;

class Service {
  constructor(private keyValueItem: MyKeyValueItem) {
  }

  async getTopUsers(): Promise<User[]> {
    // Might be undefined. You have to handle this case.
    // Use Broker Cache if you want to avoid this.
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


