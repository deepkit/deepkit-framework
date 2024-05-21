# Broker Bus

Deepkit Message Bus is a message bus system (Pub/Sub, distributed event system) that allows you to send messages or events between different parts of your application.

It can be used in microservices, monoliths, or any other kind of application. Perfectly suited for event-driven architectures.  

It is different to the Deepkit Event system, which is used for in-process events. The Broker Bus is used for events that need to be sent to other processes or servers. Broker Bus is also perfectly suited when you want to communicate between several works that were automatically started by FrameworkModule, e.g. `new FrameworkModule({workers: 4})`.

The system is designed to be type-safe and automatically serializes and deserializes messages (using BSON).

## Usage

```typescript
import { BrokerBus } from '@deepkit/broker';

const bus = new BrokerBus(adapter);

// move this type to a shared file
type Events = { type: 'user-created', id: number } | { type: 'user-deleted', id: number };

const channel = bus.channel<Events>('my-events-channel');

await channel.subscribe((event) => {
  if (event.type === 'user-created') {
    console.log('User created', event.id);
  } else if (event.type === 'user-deleted') {
    console.log('User deleted', event.id);
  }
});

await channel.publish({ type: 'user-created', id: 1 });
```

By defining a name and a type for the channel, you can ensure that only messages of the correct type are sent and received.
The data is automatically serialized and deserialized (using BSON).

## App Usage

A full example of how to use the BrokerBus in your application.
The class is automatically available in the dependency injection container if you import the `FrameworkModule`.
See the Getting started page for more information.

```typescript
import { BrokerBus, BrokerBusChannel } from '@deepkit/broker';
import { FrameworkModule } from '@deepkit/framework';

// it's a good to have these types defined in a common file so you can reuse them
// and inject them into your services
type MyChannelMessage = {
  id: number;
  name: string;
};
// move this type to a shared file
type MyChannel = BrokerBusChannel<MyChannelMessage>;

class Service {
  constructor(private channel: MyChannel) {
  }

  async update() {
    await this.channel.publish({ id: 1, name: 'Peter' });
  }
}

const app = new App({
  providers: [
    Service,
    provide<MyChannel>((bus: BrokerBus) => bus.channel<MyChannelMessage>('my-channel')),
  ],
  imports: [
    new FrameworkModule(),
  ],
});
```
