# Broker Bus

Deepkit Message Bus ist ein Message-Bus-System (Pub/Sub, verteiltes Event-System), das es dir ermöglicht, Nachrichten oder Events zwischen verschiedenen Teilen deiner Anwendung zu senden.

Es kann in Microservices, Monolithen oder jeder anderen Art von Anwendung verwendet werden. Perfekt geeignet für ereignisgesteuerte Architekturen.  

Es unterscheidet sich vom Deepkit Event-System, das für In-Process-Events verwendet wird. Der Broker Bus wird für Events genutzt, die an andere Prozesse oder Server gesendet werden müssen. Broker Bus ist auch perfekt geeignet, wenn du zwischen mehreren Workern kommunizieren möchtest, die automatisch vom FrameworkModule gestartet wurden, z. B. `new FrameworkModule({workers: 4})`.

Das System ist darauf ausgelegt, type-safe zu sein und serialisiert sowie deserialisiert Nachrichten automatisch (mit BSON). Wenn du [Validierung](../runtime-types/validation.md) zu deinen Nachrichtentypen hinzufügst, werden die Nachrichten außerdem vor dem Senden und nach dem Empfangen validiert. Das stellt sicher, dass die Nachrichten immer im korrekten Format sind und die erwarteten Daten enthalten.

## Verwendung

```typescript
import { BrokerBus } from '@deepkit/broker';

const bus = new BrokerBus(adapter);

// verschiebe diesen Typ in eine gemeinsame Datei
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

Wenn du einen Namen und einen Typ für den Channel definierst, stellst du sicher, dass nur Nachrichten des korrekten Typs gesendet und empfangen werden.
Die Daten werden automatisch serialisiert und deserialisiert (mit BSON).

## App-Verwendung

Ein vollständiges Beispiel dafür, wie du den BrokerBus in deiner Anwendung verwendest.
Die Klasse ist automatisch im Dependency-Injection-Container verfügbar, wenn du das `FrameworkModule` importierst.
Siehe die Getting-Started-Seite für weitere Informationen.

### Subject

Der Standardansatz zum Senden und Empfangen von Nachrichten ist die Verwendung des rxjs-`Subject`-Typs. Seine `subscribe`- und `next`-Methoden ermöglichen es dir, Nachrichten type-safe zu senden und zu empfangen. Alle Subject-Instanzen werden vom Broker verwaltet, und sobald das Subject vom Garbage Collector eingesammelt wurde, wird die Subscription aus dem Broker-Backend (z. B. Redis) entfernt.

Überschreibe den `BusBrokerErrorHandler` von BrokerBus, um Fehler beim Publishen oder Subscriben von Nachrichten zu behandeln.

Dieser Ansatz entkoppelt deinen Business-Code sauber vom Broker-Server und ermöglicht dir, denselben Code in einer Testumgebung ohne Broker-Server zu verwenden.

```typescript
import { BrokerBus, BrokerBusChannel, provideBusSubject } from '@deepkit/broker';
import { FrameworkModule } from '@deepkit/framework';
import { Subject } from 'rxjs';

// verschiebe diesen Typ in eine gemeinsame Datei
type MyChannel = Subject<{
    id: number;
    name: string;
}>;

class Service {
    // MyChannel ist kein Singleton, sondern für jede Request wird eine neue Instanz erstellt.
    // Seine Lebenszeit wird vom Framework überwacht und sobald das Subject vom Garbage Collector
    // eingesammelt wurde, wird die Subscription aus dem Broker-Backend (z. B. Redis) entfernt.
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
        return this.channel;
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

Wenn du eine Bestätigung für das Senden der Nachricht benötigst und Fehler in jedem Fall behandeln möchtest, kannst du den `BrokerBusChannel`-Typ verwenden. Dessen `subscribe`- und `publish`-Methoden geben jeweils eine Promise zurück.

```typescript
import { BrokerBus, BrokerBusChannel, provideBusChannel } from '@deepkit/broker';
import { FrameworkModule } from '@deepkit/framework';

// verschiebe diesen Typ in eine gemeinsame Datei
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