# Broker-Queue

Deepkit Message Queue ist ein Message-Queue-System, das es ermöglicht, Messages an den Queue-Server zu senden und von Workern verarbeiten zu lassen.

Das System ist type-safe konzipiert und serialisiert sowie deserialisiert Messages automatisch (mit BSON).

Die Daten werden auf dem Server persistiert, sodass sie selbst bei einem Serverabsturz nicht verloren gehen.

## Verwendung

```typescript
import { BrokerQueue, BrokerQueueChannel } from '@deepkit/broker';

const queue = new BrokerQueue(adapter);

type User = { id: number, username: string };

const registrationChannel = queue.channel<User>('user/registered', {
  process: QueueMessageProcessing.exactlyOnce,
  deduplicationInterval: '1s',
});

// Ein Worker konsumiert die Messages.
// Dies geschieht üblicherweise in einem separaten Prozess.
await registrationChannel.consume(async (user) => {
  console.log('User registered', user);
  // Wenn der Worker hier abstürzt, geht die Message nicht verloren.
  // Sie wird automatisch an einen anderen Worker erneut zugestellt.
  // Wenn dieser Callback ohne Error zurückkehrt, wird die Message 
  // als verarbeitet markiert und schließlich entfernt.
});

// Die Anwendung, die die Message sendet
await registrationChannel.produce({ id: 1, username: 'Peter' });
```

## App-Verwendung

Ein vollständiges Beispiel, wie Sie die BrokerQueue in Ihrer Anwendung verwenden.
Die Class ist im Dependency Injection Container automatisch verfügbar, wenn Sie das `FrameworkModule` importieren.
Siehe die Seite Erste Schritte für weitere Informationen.

Um die Queuesysteme optimal zu nutzen, wird empfohlen, mehrere Worker zu starten, die die Messages konsumieren.
Dafür schreiben Sie eine separate `App`, die sich von der Hauptanwendung unterscheidet, die ggf. HTTP-Routen usw. hat.

Gemeinsame Services teilen Sie über ein gemeinsames App-Modul. Channel-Definitionen werden über den Rest der Anwendung in einer gemeinsamen Datei geteilt.

```typescript
// Datei: channels.ts

export type RegistrationChannel = BrokerQueueChannel<User>;
export const registrationChannelProvider = provide<RegistrationChannel>((queue: BrokerQueue) => queue.channel<User>('user/registered', {
  process: QueueMessageProcessing.exactlyOnce,
  deduplicationInterval: '1s',
}));
```

```typescript
// Datei: worker.ts
import { RegistrationChannel, registrationChannelProvider } from './channels';

async function consumerCommand(
  channel: RegistrationChannel, 
  database: Database) {

  await channel.consume(async (user) => {
    // Etwas mit dem User tun,
    // vielleicht Informationen speichern, E-Mails senden, etc.
  });

  // Die Verbindung zum Broker hält den Prozess am Leben.
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

// Startet den obigen Worker-Command direkt
void app.run('consumer');
```

Und in Ihrer Anwendung produzieren Sie Messages wie folgt:

```typescript
// Datei: app.ts
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