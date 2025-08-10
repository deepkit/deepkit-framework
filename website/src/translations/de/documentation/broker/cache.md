# Broker Cache

Die Deepkit Broker Cache Class ist ein mehrstufiger Cache (2 Ebenen), der einen flüchtigen lokalen Cache im Speicher hält und Daten vom Broker-Server nur dann abruft, wenn die Daten nicht im Cache sind, stale sind oder invalidiert wurden. Das ermöglicht sehr hohe Performance und geringe Latenz beim Datenabruf.

Der Cache ist type-safe konzipiert und serialisiert und deserialisiert Daten automatisch (mittels BSON). Er unterstützt zudem Cache Invalidation und Cache Clearing. Die Implementation stellt sicher, dass pro Prozess der Cache nur einmal neu aufgebaut wird, selbst wenn mehrere Requests gleichzeitig auf dasselbe Cache Item zugreifen.

Die Daten werden nicht auf dem Server persistiert, sondern nur im Speicher gehalten. Wenn der Server neu startet, gehen alle Daten verloren.

## Verwendung

Stellen Sie sicher, die Getting Started-Seite zu lesen, um zu lernen, wie Sie Ihre Anwendung korrekt einrichten, sodass BrokerCache im Dependency Injection Container verfügbar ist.

Die Cache Abstraction im Deepkit Broker unterscheidet sich stark von einem einfachen Key/Value Store. Sie funktioniert, indem man einen Cache-Namen und eine Builder Function definiert, die automatisch aufgerufen wird, wenn der Cache leer oder stale ist. Diese Builder Function ist dafür verantwortlich, die Daten zu erstellen, die anschließend im Cache gespeichert werden.

```typescript
import { BrokerCache, BrokerCacheItem } from '@deepkit/broker';

const cache = new BrokerCache(adapter);

const cacheItem = cache.item('my-cache', async () => {
  // Dies ist die Builder Function, die aufgerufen wird, wenn 
  // der Cache leer oder stale ist
  return 'hello world';
});


// Prüfen, ob der Cache stale oder leer ist
await cacheItem.exists();

// Daten aus dem Cache holen oder vom Broker-Server abrufen
// Ist der Cache leer oder stale, wird die Builder Function aufgerufen
// und das Ergebnis zurückgegeben und an den Broker-Server gesendet.
const topUsers = await cacheItem.get();

// Den Cache invalidieren, sodass der nächste get()-Aufruf 
// die Builder Function erneut aufruft.
// Löscht den lokalen Cache und den Server-Cache.
await cacheItem.invalidate();

// Daten manuell im Cache setzen
await cacheItem.set(xy);
```

## App-Verwendung

Ein vollständiges Beispiel, wie Sie den BrokerCache in Ihrer Anwendung verwenden.
Die Class ist automatisch im Dependency Injection Container verfügbar, wenn Sie das `FrameworkModule` importieren.
Siehe die Getting Started-Seite für weitere Informationen.

```typescript
import { BrokerCache, BrokerCacheItem } from '@deepkit/broker';
import { FrameworkModule } from '@deepkit/framework';

// Es ist sinnvoll, diese Types in einer gemeinsamen Datei zu definieren, damit Sie sie wiederverwenden
// und in Ihre Services injizieren können
type MyCacheItem = BrokerCacheItem<User[]>;

function createMyCache(cache: BrokerCache, database: Database) {
  return cache.item<User[]>('top-users', async () => {
    // Dies ist die Builder Function, die aufgerufen wird, wenn 
    // der Cache leer oder stale ist
    return await database.query(User)
      .limit(10).orderBy('score').find();
  });
}

class Service {
  constructor(private cacheItem: MyCacheItem) {
  }

  async getTopUsers() {
    return await this.cacheItem.get();
  }
}

const app = new App({
  providers: [
    Service,
    Database,
    provide<MyCacheItem>(createMyCache),
  ],
  imports: [
    new FrameworkModule(),
  ],
});

const cacheItem = app.get<MyCacheItem>();

// Daten aus dem Cache holen oder vom Broker-Server abrufen
const topUsers = await cacheItem.get();
```