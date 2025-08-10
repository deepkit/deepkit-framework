# HTTP

Die Verarbeitung von HTTP-Anfragen gehört zu den bekanntesten Aufgaben eines Servers. Dabei wird eine Eingabe (HTTP Request) in eine Ausgabe (HTTP Response) überführt und eine spezifische Aufgabe ausgeführt. Ein Client kann Daten auf unterschiedliche Weise per HTTP Request an den Server senden, die korrekt gelesen und verarbeitet werden müssen. Neben dem HTTP-Body sind auch HTTP-Query- oder HTTP-Header-Werte möglich. Wie Daten tatsächlich verarbeitet werden, hängt vom Server ab. Der Server definiert, wohin und wie die Werte vom Client gesendet werden sollen.

Die höchste Priorität ist hier nicht nur, das zu tun, was der Benutzer erwartet, sondern alle Eingaben aus dem HTTP Request korrekt zu konvertieren (deserialisieren) und zu validieren.

Die Pipeline, durch die ein HTTP Request auf dem Server läuft, kann vielfältig und komplex sein. Viele einfache HTTP-Libraries reichen für eine gegebene Route nur den HTTP Request und die HTTP Response durch und erwarten, dass der Entwickler die HTTP Response direkt verarbeitet. Eine Middleware-API ermöglicht es, die Pipeline bei Bedarf zu erweitern.

_Express-Beispiel_

```typescript
const http = express();
http.get('/user/:id', (request, response) => {
    response.send({id: request.params.id, username: 'Peter' );
});
```

Das ist für einfache Use Cases sehr gut geeignet, wird jedoch mit wachsender Anwendung schnell unübersichtlich, da alle Eingaben und Ausgaben manuell serialisiert bzw. deserialisiert und validiert werden müssen. Außerdem muss bedacht werden, wie Objekte und Services wie eine Datenbankabstraktion aus der Anwendung selbst bezogen werden können. Es zwingt den Entwickler dazu, eine Architektur darüberzulegen, die diese obligatorischen Funktionalitäten abbildet.

Deepkits HTTP Library nutzt hingegen die Möglichkeiten von TypeScript und Dependency Injection. Serialisierung/Deserialisierung und Validierung beliebiger Werte erfolgen automatisch auf Basis der definierten Types. Zudem können Routen entweder über eine funktionale API wie im obigen Beispiel oder über Controller-Klassen definiert werden, um die unterschiedlichen Anforderungen einer Architektur abzudecken.

Es kann entweder mit einem bestehenden HTTP-Server wie Nodes `http`-Modul oder mit dem Deepkit-Framework verwendet werden. Beide API-Varianten haben Zugriff auf den Dependency-Injection-Container und können so bequem Objekte wie eine Datenbankabstraktion und Konfigurationen aus der Anwendung beziehen.

## Beispiel: Funktionale API

```typescript
import { Positive } from '@deepkit/type';
import { http, HttpRouterRegistry } from '@deepkit/http';
import { FrameworkModule } from "@deepkit/framework";

//Funktionale API
const app = new App({
    imports: [new FrameworkModule()]
});
const router = app.get(HttpRouterRegistry);

router.get('/user/:id', (id: number & Positive, database: Database) => {
    //id ist garantiert eine number und positiv.
    //database wird vom DI Container injiziert.
    return database.query(User).filter({ id }).findOne();
});

app.run();
```

## Controller-API mit Klassen

```typescript
import { Positive } from '@deepkit/type';
import { http, HttpRouterRegistry } from '@deepkit/http';
import { FrameworkModule } from "@deepkit/framework";
import { User } from "discord.js";

//Controller-API
class UserController {
    constructor(private database: Database) {
    }

    @http.GET('/user/:id')
    user(id: number & Positive) {
        return this.database.query(User).filter({ id }).findOne();
    }
}

const app = new App({
    controllers: [UserController],
    imports: [new FrameworkModule()]
});
```