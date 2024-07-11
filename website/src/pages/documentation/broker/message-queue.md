# Broker Queue

Deepkit Message Queue is a message queue system that allows you to send messages to the queue server and have workers process them.

The system is designed to be type-safe and automatically serializes and deserializes messages (using BSON).

The data is persisted on the server, so even if the server crashes, the data is not lost.

## Usage

```typescript
import { BrokerQueue, BrokerQueueChannel } from '@deepkit/broker';

const queue = new BrokerQueue(adapter);

type User = { id: number, username: string };

const registrationChannel = queue.channel<User>('user/registered', {
  process: QueueMessageProcessing.exactlyOnce,
  deduplicationInterval: '1s',
});

// a worker consumes the messages.
// this is usually done in a separate process.
await registrationChannel.consume(async (user) => {
  console.log('User registered', user);
  // if the worker crashes here, the message is not lost.
  // it will be automatically redelivered to another worker.
  // if this callback returns without an error, the message is 
  // marked as processed and eventually removed.
});

// the application sending the message
await registrationChannel.produce({ id: 1, username: 'Peter' });
```

## App Usage

A full example of how to use the BrokerQueue in your application.
The class is automatically available in the dependency injection container if you import the `FrameworkModule`.
See the Getting started page for more information.

To utilize the queue systems the most, it is recommended to start several workers that consume the messages.
You would write a separate `App` that is different to the main application that might have http routes etc.

You share common services via a shared app module. Channel definitions are shared via the rest of the application in a common file.

```typescript
// file: channels.ts

export type RegistrationChannel = BrokerQueueChannel<User>;
export const registrationChannelProvider = provide<RegistrationChannel>((queue: BrokerQueue) => queue.channel<User>('user/registered', {
  process: QueueMessageProcessing.exactlyOnce,
  deduplicationInterval: '1s',
}));
```

```typescript
// file: worker.ts
import { RegistrationChannel, registrationChannelProvider } from './channels';

async function consumerCommand(
  channel: RegistrationChannel, 
  database: Database) {

  await channel.consume(async (user) => {
    // do something with the user,
    // maybe store information, send emails, etc.
  });

  // the connection to the broker keeps the process alive.
}

const app = new App({
  providers: [
    Database,
    registrationChannelProvider,
  ],
  imports: [
    new FrameworkModule({}),
  ],
});

app.command('consumer', consumerCommand);

// start the worker command above directly
void app.run('consumer');
```

And in your application you produce messages like this:

```typescript
// file: app.ts
import { RegistrationChannel, registrationChannelProvider } from './channels';

class Service {
  constructor(private channel: RegistrationChannel) {
  }

  async registerUser(user: User) {
    await this.channel.produce(user);
  }
}

const app = new App({
  providers: [
    Service,
    registrationChannelProvider,
  ],
  imports: [
    new FrameworkModule({}),
  ],
});

void app.run();
```
