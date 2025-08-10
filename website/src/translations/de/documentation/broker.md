# Deepkit Broker

Deepkit Broker ist eine High-Performance-Abstraktion für Message Queues, Message Bus, Event Bus, Pub/Sub, Key/Value Store, Cache und atomare Operationen. Alles im Sinne von Typsicherheit mit automatischer Serialisierung und Validierung, hoher Performance und Skalierbarkeit. 

Deepkit Broker ist Client und Server in einem. Er kann als eigenständiger Server verwendet werden oder als Client, um sich mit anderen Deepkit-Broker-Servern zu verbinden. Er ist für den Einsatz in einer Microservice-Architektur konzipiert, kann aber auch in einer Monolith-Anwendung verwendet werden.

Der Client verwendet das Adapter-Pattern, um verschiedene Backends zu unterstützen. Sie können denselben Code mit unterschiedlichen Backends verwenden oder sogar mehrere Backends gleichzeitig nutzen.

Aktuell sind 3 Adapter verfügbar. Einer ist der Standard-Adapter `BrokerDeepkitAdapter`, der mit dem Deepkit-Broker-Server kommuniziert und mit Deepkit Broker out of the box mitgeliefert wird (inklusive Server). 
Der zweite ist `BrokerRedisAdapter` in [@deepkit/broker-redis](./package/broker-redis), der mit einem Redis-Server kommuniziert. Der dritte ist `BrokerMemoryAdapter`, ein In-Memory-Adapter für Testzwecke.

## Installation

Deepkit Broker wird standardmäßig installiert und aktiviert, wenn das [Deepkit Framework](./framework.md) verwendet wird. Andernfalls können Sie es über Folgendes installieren:

```bash
npm install @deepkit/broker
```

## Broker-Klassen

Deepkit Broker stellt diese Haupt-Broker-Klassen bereit: 

- **BrokerCache** - L2-Cache-Abstraktion mit Cache-Invalidierung 
- **BrokerBus** - Message Bus (Pub/Sub)
- **BrokerQueue** - Queue-System
- **BrokerLock** - Verteilter Lock
- **BrokerKeyValue** - Key/Value Store

Diese Klassen sind dafür ausgelegt, einen Broker-Adapter zu verwenden, um typsicher mit einem Broker-Server zu kommunizieren.

```typescript
import { BrokerBus, BrokerMemoryAdapter } from '@deepkit/broker';

const bus = new BrokerBus(new BrokerMemoryAdapter());
const channel = bus.channel<{ foo: string }>('my-channel-name');
await channel.subscribe((message) => {
  console.log('received message', message);
});

await channel.publish({ foo: 'bar' });
```

Das FrameworkModule stellt den Standard-Adapter bereit, registriert ihn und verbindet sich mit dem Deepkit-Broker-Server, der standardmäßig im selben Prozess läuft.

Dank Runtime Types und des Aufrufs `channel<Type>('my-channel-name');` ist alles typsicher und die Nachricht kann direkt im Adapter automatisch validiert und serialisiert werden.
Die Standardimplementierung `BrokerDeepkitAdapter` übernimmt das automatisch für Sie (und verwendet BSON für die Serialisierung).

Beachten Sie, dass jede Broker-Klasse ihr eigenes Adapter-Interface hat, sodass Sie nur die Methoden implementieren können, die Sie benötigen. Der `BrokerDeepkitAdapter` implementiert all diese Interfaces und kann in allen Broker-APIs verwendet werden.

## Anwendungsintegration

Um diese Klassen in einer Deepkit-Anwendung mit Dependency Injection zu verwenden, können Sie das `FrameworkModule` nutzen, das Folgendes bereitstellt:

- einen Standard-Adapter für den Broker-Server
- den Broker-Server selbst (und startet ihn automatisch)
- und registriert alle Broker-Klassen als Provider

Das `FrameworkModule` stellt basierend auf der Konfiguration einen Standard-Broker-Adapter für den konfigurierten Broker-Server bereit.
Es registriert außerdem Provider für alle Broker-Klassen, sodass Sie diese (z. B. BrokerBus) direkt in Ihre Services und Provider-Factories injizieren können.

```typescript
// in einer separaten Datei, z. B. broker-channels.ts
type MyBusChannel = BrokerBusChannel<MyMessage>;

const app = new App({
  providers: [
    Service,
    provide<MyBusChannel>((bus: BrokerBus) => bus.channel<MyMessage>('my-channel-name')),
  ],
  imports: [new FrameworkModule({
    broker: {
      // Wenn startOnBootstrap true ist, startet der Broker-Server unter dieser Adresse. Unix-Socket-Pfad oder Host:Port-Kombination
      listen: 'localhost:8811', // oder 'var/broker.sock';
      // Wenn ein anderer Broker-Server verwendet werden soll, ist dies seine Adresse. Unix-Socket-Pfad oder Host:Port-Kombination.
      host: 'localhost:8811', //oder 'var/broker.sock';
      // Startet automatisch einen einzelnen Broker im Hauptprozess. Deaktivieren Sie dies, wenn Sie einen eigenen Broker-Node haben.
      startOnBootstrap: true,
    },
  })],
});
```

Sie können dann die abgeleiteten Broker-Klassen (oder die Broker-Klasse direkt) in Ihre Services injizieren:

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

Es ist immer eine gute Idee, einen abgeleiteten Typ für Ihre Channels zu erstellen (wie oben mit `MyBusChannel`), sodass Sie diese einfach in Ihre Services injizieren können.
Andernfalls müssten Sie `BrokerBus` injizieren und jedes Mal `channel<MyMessage>('my-channel-name')` aufrufen, was fehleranfällig ist und nicht DRY.

Fast alle Broker-Klassen haben diese Art von Ableitung, sodass Sie sie an einer Stelle definieren und überall verwenden können. Siehe die entsprechende Broker-Klassen-Dokumentation für weitere Informationen.

## Benutzerdefinierter Adapter

Wenn Sie einen benutzerdefinierten Adapter benötigen, können Sie Ihren eigenen Adapter erstellen, indem Sie eines oder mehrere der folgenden Interfaces aus `@deepkit/broker` implementieren:

```typescript
export type BrokerAdapter = BrokerAdapterCache & BrokerAdapterBus & BrokerAdapterLock & BrokerAdapterQueue & BrokerAdapterKeyValue;
```

```typescript
import { BrokerAdapterBus, BrokerBus, Release } from '@deepkit/broker';
import { Type } from '@deepkit/type';

class MyAdapter implements BrokerAdapterBus {
  disconnect(): Promise<void> {
    // implementieren: Verbindung vom Broker-Server trennen
  }
  async publish(name: string, message: any, type: Type): Promise<void> {
    // implementieren: Nachricht an den Broker-Server senden, name ist 'my-channel-name', message ist { foo: 'bar' }
  }
  async subscribe(name: string, callback: (message: any) => void, type: Type): Promise<Release> {
    // implementieren: Beim Broker-Server subscriben, name ist 'my-channel-name'
  }
}

// oder BrokerDeepkitAdapter für den Standard-Adapter
const adapter = new MyAdapter;
const bus = new BrokerBus(adapter);

```

## Broker-Server

Der Broker-Server startet standardmäßig automatisch, sobald Sie das `FrameworkModule` importieren und den Befehl `server:start` ausführen.
Alle Broker-Klassen sind standardmäßig so konfiguriert, dass sie sich mit diesem Server verbinden.

In einer Produktionsumgebung würden Sie den Broker-Server in einem separaten Prozess oder auf einer anderen Maschine ausführen. 
Anstatt `server:start` zu verwenden, würden Sie den Broker-Server mit `server:broker:start` starten.

Wenn Sie viel Traffic haben und Skalierbarkeit benötigen, sollten Sie stattdessen den [Redis-Adapter](./package/broker-redis.md) verwenden. Er ist in der Einrichtung etwas komplizierter, 
da Sie einen Redis-Server betreiben müssen, aber er ist performanter und kann mehr Traffic verarbeiten.

```bash
ts-node app.ts server:broker:start
```

Dies startet den Server auf dem Host, der z. B. über `new FrameworkModule({broker: {listen: 'localhost:8811'}})` konfiguriert ist.
Sie können die Adresse auch über Umgebungsvariablen ändern, wenn Sie `app.loadConfigFromEnv({prefix: 'APP_', namingStrategy: 'upper'});` aktiviert haben:

```bash
APP_FRAMEWORK_BROKER_LISTEN=localhost:8811 ts-node app.ts server:broker:start
```

Wenn Sie den Server manuell starten, stellen Sie sicher, dass Sie den automatischen Start des Broker-Servers über `startOnBootstrap: false` in Ihrer Anwendungskonfiguration deaktivieren.