---
title: Deepkit Broker
package: '@deepkit/broker'
doc: broker
api: broker
category: broker
---

<p class="introduction">
    High performance typesafe message bus server for pub/sub pattern, key-value storage, and central atomic app locks. A highly configurable message broker written in and for TypeScript.
</p>

## Features

<div class="app-boxes-small">
    <box title="Key/Value">Typesafe key value storage.</box>
    <box title="Pub/Sub">pub/sub pattern with typesafe messages.</box>
    <box title="Atomic Ops">Atomic lock and increment operations.</box>
</div>

<feature>

## Key/Value

Typesafe key/value storage with automatic binary serialization and validation.

The data is serialized using a very fast binary encoding and stored on the server using efficient ArrayBuffers.

```typescript
import { BrokerClient } from '@deepkit/broker';
import { t } from '@deepkit/type';

const client = new BrokerClient();

const userLogins = client.key<number>('logins/123');
await userLogins.set(123);
const logins = await userLogins.get();
await userLogins.delete();
```

</feature>

<feature class="right">

## Key/Value

Atomic increment and decrement operations.

```typescript
import { BrokerClient } from '@deepkit/broker';

const client = new BrokerClient();

client.increment('logins/user1', +1);

const v = client.increment('logins/user1', -1);
expect(v).toBe(0);

client.delete('logins/user1');
```

</feature>

<feature>

## Pub/Sub

Typesafe pub/sub pattern.

```typescript
import { BrokerClient } from '@deepkit/broker';

const client = new BrokerClient();

type Message = { value: number };
const channel1 = client.channel<Message>('channel1');

await channel1.subscribe(v => message => {
  console.log('got message', message);
});

await channel1.publish({ value: 1345 });
```

</feature>

<feature class="right">

## Atomic locks

Atomic locks for distributed systems and critical region locking.

```typescript
import { BrokerClient } from '@deepkit/broker';

const client = new BrokerClient();

if (await client.isLocked('lock1')) {
  // lock in place already.
}

// blocks until lock acquired.
const lock1 = await client.lock('lock1');
try {
  // do critical work.
} finally {
  await lock1.unsubscribe();
}
```

</feature>
