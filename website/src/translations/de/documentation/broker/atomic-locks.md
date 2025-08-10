# Broker Atomare Locks

Deepkit Broker Locks ist eine einfache Möglichkeit, atomare Locks über mehrere Prozesse oder Maschinen hinweg zu erstellen. 

Es ist eine einfache Möglichkeit sicherzustellen, dass jeweils nur ein Prozess einen bestimmten Code-Block ausführen kann.

## Verwendung

```typescript
import { BrokerLock } from '@deepkit/broker';

const lock = new BrokerLock(adapter);

// Lock ist für 60 Sekunden aktiv.
// Acquisition-Timeout beträgt 10 Sekunden.
const myLock = lock.item('my-lock', { ttl: '60s', timeout: '10s' });

async function criticalSection() {
  // Hält den Lock, bis die Funktion beendet ist.
  // Bereinigt den Lock automatisch, selbst wenn die Funktion einen Error wirft.
  await using hold = await lock1.hold();
}
```

Der Lock unterstützt [Explicit Resource Management](https://github.com/tc39/proposal-explicit-resource-management), was bedeutet, dass du keinen try-catch-Block verwenden musst, um sicherzustellen, dass der Lock ordnungsgemäß freigegeben wird.

Um einen Lock manuell zu erwerben und freizugeben, kannst du die Methoden `acquire` und `release` verwenden.

```typescript
// Dies blockiert, bis der Lock erworben wurde.
// oder wirft, wenn das Timeout erreicht ist
await myLock.acquire();

try {
  // etwas Kritisches ausführen
} finally {
  await myLock.release();
}
```

## Verwendung in der App

Ein vollständiges Beispiel dafür, wie du BrokerLock in deiner Anwendung verwendest.
Die Class ist im Dependency-Injection-Container automatisch verfügbar, wenn du das `FrameworkModule` importierst.
Siehe die Seite Erste Schritte für weitere Informationen.

```typescript
import { BrokerLock, BrokerLockItem } from '@deepkit/broker';
import { FrameworkModule } from '@deepkit/framework';

// Verschiebe diesen Type in eine gemeinsame Datei
type MyCriticalLock = BrokerLockItem;

class Service {
  constructor(private criticalLock: MyCriticalLock) {
  }

  async doSomethingCritical() {
    await using hold = await this.criticalLock.hold();
    
    // etwas Kritisches ausführen,
    // Lock wird automatisch freigegeben
  }
}

const app = new App({
  providers: [
    Service,
    provide<MyCriticalLock>((lock: BrokerLock) => lock.item('my-critical-lock', { ttl: '60s', timeout: '10s' })),
  ],
  imports: [
    new FrameworkModule(),
  ],
});
```