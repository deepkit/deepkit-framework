# Deepkit Broker

Deepkit Broker is a high-performance abstraction for message queues, message bus, event bus, pub/sub, key/value store, cache, and atomic operations. All in the spirit of type-safety with automatic serialization and validation, high-performance, and scalability. 

Deepkit Broker is a client and a server in one. It can be used as a standalone server, or as a client to connect to other Deepkit Broker servers. It's designed to be used in a microservice architecture, but can also be used in a monolith application.

The client uses an adapter pattern to support different backends. You can use the same code with different backends, or even use multiple backends at the same time.

Currently, there are 3 adapters available. One is the default `BrokerDeepkitAdapter` which communicates with the Deepkit Broker server and comes with Deepkit Broker out of the box (including the server). 
The second is `BrokerRedisAdapter` in [@deepkit/broker-redis](./package/broker-redis) which communicates with a Redis server. The third is `BrokerMemoryAdapter` which is an in-memory adapter for testing purposes.

## Installation

Deepkit Broker is installed and activated per default when [Deepkit Framework](./framework.md) is used. Otherwise, you can install it via:

```bash
npm install @deepkit/broker
```

## Broker Classes

Deepkit Broker provides these main broker classes: 

- **BrokerCache** - L2 cache abstraction with cache invalidation 
- **BrokerBus** - Message bus (Pub/Sub)
- **BrokerQueue** - Queue system
- **BrokerLock** - Distributed lock
- **BrokerKeyValue** - Key/Value store

These classes are designed to take a broker adapter to communicate with a broker server in a type-safe way.

```typescript
import { BrokerBus, BrokerMemoryAdapter } from '@deepkit/broker';

const bus = new BrokerBus(new BrokerMemoryAdapter());
const channel = bus.channel<{ foo: string }>('my-channel-name');
await channel.subscribe((message) => {
  console.log('received message', message);
});

await channel.publish({ foo: 'bar' });
```

The FrameworkModule provides and registers the default adapter and connects to Deepkit Broker server, which runs per default in the same process.

Thanks to runtime types and the call `channel<Type>('my-channel-name');` everything is type-safe and the message can be validated and serialized automatically in the adapter directly.
The default implementation `BrokerDeepkitAdapter` handles this automatically for you (and uses BSON for serialization).

Note that each broker class has its own adapter interface, so you can implement only the methods you need. The `BrokerDeepkitAdapter` implements all of these interfaces and can be used in all broker APIs.

## Application Integration

To use these classes in a Deepkit application with dependency injection, you can use the `FrameworkModule` which provides several things:

- a default adapter for the broker server
- the broker server itself (and starts it automatically)
- and registers all broker classes as providers

The `FrameworkModule` provides a default broker adapter for the configured broker server based on the given configuration.
It also registers providers for all the broker classes, so you can inject them (e.g. BrokerBus) into your services and provider factories directly.

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

If you need a custom adapter, you can create your own adapter by implementing one or more of the following interfaces from `@deepkit/broker`:

```typescript
export type BrokerAdapter = BrokerAdapterCache & BrokerAdapterBus & BrokerAdapterLock & BrokerAdapterQueue & BrokerAdapterKeyValue;
```

```typescript
import { BrokerAdapterBus, BrokerBus, Release } from '@deepkit/broker';
import { Type } from '@deepkit/type';

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

// or BrokerDeepkitAdapter for the default adapter
const adapter = new MyAdapter;
const bus = new BrokerBus(adapter);

```

## Broker Server

The Broker server starts automatically per default as soon as you import the `FrameworkModule` and run the `server:start` command.
All Broker classes are configured per default to connect to this server.

In a production environment, you would run the broker server in a separate process, or on a different machine. 
Instead of doing `server:start` you would start the broker server with `server:broker:start`.

If you have a lot of traffic and need scalability, you should use the [redis adapter](./package/broker-redis.md) instead. It is more complicated to set up, 
since you have to run a Redis server, but it is more performant and can handle more traffic.

```bash
ts-node app.ts server:broker:start
```

This starts the server on the host configured via for example `new FrameworkModule({broker: {listen: 'localhost:8811'}})`.
You could change the address also via environment variables if you enabled `app.loadConfigFromEnv({prefix: 'APP_', namingStrategy: 'upper'});`:

```bash
APP_FRAMEWORK_BROKER_LISTEN=localhost:8811 ts-node app.ts server:broker:start
```

If you start the server manually, make sure to disable automatic broker server start via `startOnBootstrap: false` in your application configuration.
