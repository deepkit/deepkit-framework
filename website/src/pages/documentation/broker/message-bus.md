# Broker Bus

Deepkit Message Bus is a message bus system (Pub/Sub, distributed event system) that allows you to send messages or events between different parts of your application.

It can be used in microservices, monoliths, or any other kind of application. Perfectly suited for event-driven architectures.  

It is different to the Deepkit Event system, which is used for in-process events. The Broker Bus is used for events that need to be sent to other processes or servers. Broker Bus is also perfectly suited when you want to communicate between several workers that were automatically started by FrameworkModule, e.g. `new FrameworkModule({workers: 4})`.

The system is designed to be type-safe and automatically serializes and deserializes messages (using BSON).

## Usage

```typescript
import { BrokerBus } from '@deepkit/broker';

const bus = new BrokerBus(adapter);

// move this type to a shared file
type UserEvent = { type: 'user-created', id: number } | { type: 'user-deleted', id: number };

const channel = bus.channel<Events>('user-events');

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

### Subject

The default approach to send and listen to messages is using rxjs `Subject` type. It's `subscribe` and `next` methods return nothing and silently ignore errors.
They lifetime is managed by the framework and once the Subject is garbage collected, the subscription is removed from the broker backend (e.g. Redis).

Override BusBroker to handle handel `publishFailed` or `subscribeFailed` cases.

This approach nicely decouples your business code with the broker server and allows you to use the same code in a test environment without a broker server.

```typescript
import { BrokerBus, BrokerBusChannel, provideBusSubject } from '@deepkit/broker';
import { FrameworkModule } from '@deepkit/framework';
import { Subject } from 'rxjs';
import { decoupleSubject } from '@deepkit/core-rxjs';

// move this type to a shared file
type MyChannel = Subject<{
    id: number;
    name: string;
}>;

class Service {
    // MyChannel is not a singleton, but a new instance is created for each request.
    // Its lifetime is monitored by the framework and once the subject is garbage collected, 
    // the subscription is removed from the broker backend (e.g. Redis).
    constructor(private channel: MyChannel) {
        this.channel.subscribe((message) => {
            console.log('received message', message);
        });
    }

    update() {
        this.channel.next({ id: 1, name: 'Peter' });
    }
}

@rpc.controller('my-controller')
class MyRpcController {
    constructor(private channel: MyChannel) {
    }

    @rpc.action()
    getChannelData(): MyChannel {
        // this creates a new subject, forwarding all messages from the broker
        // to the connected client. `decoupleSubject` is needed in order
        // to no close the Subject when the client disconnects.
        return decoupleSubject(this.channel);
    }
}

const app = new App({
    controllers: [MyRpcController],
    providers: [
        Service,
        provideBusSubject<MyChannel>('my-channel'),
    ],
    imports: [
        new FrameworkModule(),
    ],
});
```

### BusChannel 

If you need confirmation of the message being sent and want to handle errors in each case, you can use the `BrokerBusChannel` type. It's `subscribe` and `publish` methods return a promise.

```typescript
import { BrokerBus, BrokerBusChannel, provideBusChannel } from '@deepkit/broker';
import { FrameworkModule } from '@deepkit/framework';

// move this type to a shared file
type MyChannel = BrokerBusChannel<{
    id: number;
    name: string;
}>;

class Service {
    constructor(private channel: MyChannel) {
        this.channel.subscribe((message) => {
            console.log('received message', message);
        }).catch(e => {
            console.error('Error while subscribing', e);
        });
    }

    async update() {
        await this.channel.publish({ id: 1, name: 'Peter' });
    }
}

const app = new App({
    providers: [
        Service,
        provideBusChannel<MyChannel>('my-channel'),
    ],
    imports: [
        new FrameworkModule(),
    ],
});
```
