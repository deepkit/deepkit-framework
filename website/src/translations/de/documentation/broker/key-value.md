# Broker Key-Value

Die Deepkit Broker Key-Value Class ist eine einfache Key/Value-Store-Abstraktion, die mit dem Broker-Server funktioniert. Sie ist eine einfache Möglichkeit, Daten vom Broker-Server zu speichern und abzurufen.

Es ist kein lokales Caching implementiert. Alle `get`-Aufrufe sind jedes Mal echte Netzwerk-Requests an den Broker-Server. Um dies zu vermeiden, verwenden Sie die Broker Cache Abstraktion.

Die Daten werden auf dem Server nicht persistent gespeichert, sondern nur im Speicher gehalten. Wenn der Server neu startet, gehen alle Daten verloren.

## Verwendung

```typescript
import { BrokerKeyValue } from '@deepkit/broker';

const keyValue = new BrokerKeyValue(adapter, {
  ttl: '60s', // Time to Live für jeden Key. 0 bedeutet keine TTL (Standard).
});

const item = keyValue.item<number>('key1');

await item.set(123);
console.log(await item.get()); //123

await item.remove();
```

Die Daten werden basierend auf dem gegebenen Type automatisch mit BSON serialisiert und deserialisiert.

Die Methods `set` und `get` können auch direkt auf der `BrokerKeyValue`-Instanz aufgerufen werden, haben jedoch den Nachteil, dass Sie jedes Mal den Key und den Type übergeben müssen.

```typescript
await keyValue.set<number>('key1', 123);
console.log(await keyValue.get<number>('key1')); //123
```

## Increment

Die Method `increment` ermöglicht es, den Wert eines Keys atomar um einen gegebenen Betrag zu erhöhen.

Beachten Sie, dass dies einen eigenen Eintrag im Speicher auf dem Server erstellt und nicht mit `set` oder `get` kompatibel ist. 

```typescript

const activeUsers = keyValue.item<number>('activeUsers');

// Atomar um 1 inkrementieren
await activeUsers.increment(1);

await activeUsers.increment(-1);

// Die einzige Möglichkeit, den aktuellen Wert zu erhalten, ist, increment mit 0 aufzurufen
const current = await activeUsers.increment(0);

// entfernt den Eintrag
await activeUsers.remove();
```

## App-Verwendung

Ein vollständiges Beispiel, wie Sie BrokerKeyValue in Ihrer Anwendung verwenden.
Die Class ist im Dependency-Injection-Container automatisch verfügbar, wenn Sie das `FrameworkModule` importieren.
Weitere Informationen finden Sie auf der Seite Erste Schritte.

```typescript
import { BrokerKeyValue, BrokerKeyValueItem } from '@deepkit/broker';
import { FrameworkModule } from '@deepkit/framework';

// Verschieben Sie diesen Type in eine gemeinsame Datei
type MyKeyValueItem = BrokerKeyValueItem<User[]>;

class Service {
  constructor(private keyValueItem: MyKeyValueItem) {
  }

  async getTopUsers(): Promise<User[]> {
    // Könnte undefined sein. Sie müssen diesen Fall behandeln.
    // Verwenden Sie Broker Cache, wenn Sie dies vermeiden möchten.
    return await this.keyValueItem.get();
  }
}

const app = new App({
  providers: [
    Service,
    provide<MyKeyValueItem>((keyValue: BrokerKeyValue) => keyValue.item<User[]>('top-users')),
  ],
  imports: [
    new FrameworkModule(),
  ],
});
```