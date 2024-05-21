# Deepkit Broker

Deepkit Broker is a high-performance abstraction for message queues, message bus, event bus, pub/sub, key/value store, cache, and atomic operations. All in the spirit of type-safety with automatic serialization and validation, high-performance, and scalability. 

Deepkit Broker is a client and a server in one. It can be used as a standalone server, or as a client to connect to other Deepkit Broker servers. It's designed to be used in a microservice architecture, but can also be used in a monolith application.

The client uses an adapter pattern to support different backends. You can use the same code with different backends, or even use multiple backends at the same time.

## Installation

Deepkit Broker is installed and activated per default when [Deepkit Framework](./framework.md) is used. Otherwise, you can install it via:

```bash
npm install @deepkit/broker
```

## Broker Classes

Deepkit Broker provides four main broker classes: 

- **BrokerCache** - L2 cache abstraction with cache invalidation 
- **BrokerBus** - Message bus (Pub/Sub)
- **BrokerQueue** - Queue system
- **BrokerLock** - Distributed lock
- **BrokerKeyValue** - Key/Value store

These classes are designed to take a broker adapter to communicate with a broker server in a type-safe way.

To give a high level overview of how the classes can be used outside the framework, here is an example:

```typescript
import { BrokerBus, BrokerAdapterBus } from '@deepkit/broker';

class MyAdapter implements BrokerAdapterBus {
  disconnect(): Promise<void> {
    // implement: disconnect from broker server
  }
  async publish(name: string, message: any, type: Type): Promise<void> {
    // implement: send message to broker server, name is 'my-channel-name', message is { foo: 'bar' }
  }
  async subscribe(name: string, callback: (message: any) => void, type: Type): Promise<Release> {
    // implemenet: subscribe to broker server, name is 'my-channel-name'
  }
}

const adapter = new MyAdapter;
const bus = new BrokerBus(adapter);

interface MyMessage {
  foo: string;
}

const channel = bus.channel<MyMessage>('my-channel-name');

await channel.subscribe((message) => {
  console.log('received message', message);
});

await channel.publish({ foo: 'bar' });
```

In this example we write our own adapter to communicate with a broker server. The adapter is then passed to the BrokerBus class, which is used to create a channel. The channel can then be used to subscribe to messages and publish messages.

Thanks to runtime types and the call `channel<MyMessage>('my-channel-name');` everything is type-safe and the message can be validated and serialized automatically in the adapter directly.
The default implementation `BrokerDeepkitAdapter` handles this automatically for you (and uses BSON for serialization).

Note that each broker class has its own adapter interface, so you can implement only the methods you need. The `BrokerDeepkitAdapter` implements all of these interfaces and can be used in all broker classes.

To use these classes in a Deepkit application with dependency injection, you can use the `FrameworkModule` which provides a default adapter for the broker server and registers all broker classes as providers. See next chapter Usage for more information.

Here is an example on how to manually set up an application with BrokerBus.

```typescript
type MyBusChannel = BrokerBusChannel<MyMessage>;

const app = new App({
  providers: [
    MyAdapter,
    provide<BrokerBus>((adapter: MyAdapter) => new BrokerBus(adapter)),
    provide<MyBusChannel>((bus: BrokerBus) => bus.channel<MyMessage>('my-channel-name')),
  ]
});

await app.get<MyBusChannel>().subscribe((message) => {
  console.log('received message', message);
});

await app.get<MyBusChannel>().publish({ foo: 'bar' });

app.get(MyAdapter).disconnect();
```

## Usage

The FrameworkModule provides a default broker adapter for the configured broker server based on the given configuration.
It also registers providers for all the broker classes, so you can inject them into your services directly.

```typescript
// in an extra file, e.g. broker-channels.ts
type MyBusChannel = BrokerBusChannel<MyMessage>;

const app = new App({
  providers: [
    Service,
    provide<MyBusChannel>((bus: BrokerBus) => bus.channel<MyMessage>('my-channel-name')),
  ],
  imports: [new FrameworkModule({
    broker: {
      // If startOnBootstrap is true, the broker server starts at this address. Unix socket path or host:port combination
      listen: 'localhost:8811', // or 'var/broker.sock';
      // If a different broker server should be used, this is its address. Unix socket path or host:port combination.
      host: 'localhost:8811', //or 'var/broker.sock';
      // Automatically starts a single broker in the main process. Disable it if you have a custom broker node.
      startOnBootstrap: true,
    },
  })],
});

void app.run();
```

You can then inject the broker derived classes (or the broker class directly) into your services:

```typescript
import { MyBusChannel } from './broker-channels.ts';

class Service {
  constructor(private bus: MyBusChannel) {
  }

  async addUser() {
    await this.bus.publish({ foo: 'bar' });
  }
}
```

It's always a good idea to create a derived type for your channels (like above with `MyBusChannel`), so you can easily inject them into your services.
Otherwise, you'd have to inject `BrokerBus` and call `channel<MyMessage>('my-channel-name')` every time you need it, which is error-prone and not DRY. 

Almost all broker classes have this kind of derivation, so you can easily define them in one place and use them everywhere. See the appropriate broker class documentation for more information.

## Custom Adapter

If you need more connections or a custom adapter, you can create your own adapter by implementing one or more of the following interfaces from `@deepkit/broker`:

```typescript
export type BrokerAdapter = BrokerAdapterCache & BrokerAdapterBus & BrokerAdapterLock & BrokerAdapterQueue & BrokerAdapterKeyValue;
```

