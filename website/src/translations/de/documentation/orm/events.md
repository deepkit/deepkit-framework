# Events

Events sind eine Möglichkeit, in Deepkit ORM einzuhaken und ermöglichen es Ihnen, leistungsfähige Plugins zu schreiben. Es gibt zwei
Kategorien von Events: Query-Events und Unit-of-Work-Events. Plugin-Autoren verwenden typischerweise beide, um beide Wege der Datenmanipulation zu unterstützen.

Events werden über `Database.listen` mit einem Event-Token registriert. Kurzlebige Event-Listener können auch
an Sessions registriert werden.

```typescript
import { Query, Database } from '@deepkit/orm';

const database = new Database(...);
database.listen(Query.onFetch, async (event) => {
});

const session = database.createSession();

//wird nur für diese bestimmte Session ausgeführt
session.eventDispatcher.listen(Query.onFetch, async (event) => {
});
```

## Query-Events

Query-Events werden ausgelöst, wenn eine Query über `Database.query()` oder `Session.query()` ausgeführt wird.

Jedes Event hat eigene zusätzliche Properties, wie z. B. den Entity-Typ, die Query selbst und die Datenbank-Session. Sie können die Query überschreiben, indem Sie eine neue Query auf `Event.query` setzen.

```typescript
import { Query, Database } from '@deepkit/orm';

const database = new Database(...);

const unsubscribe = database.listen(Query.onFetch, async event => {
    //überschreibt die Query des Benutzers, sodass etwas anderes ausgeführt wird.
    event.query = event.query.filterField('fieldName', 123);
});

//um den Hook zu entfernen, unsubscribe aufrufen
unsubscribe();
```

"Query" hat mehrere Event-Tokens:

| Event-Token        | Beschreibung                                               |
|--------------------|------------------------------------------------------------|
| Query.onFetch      | Wenn Objekte über find()/findOne()/etc abgerufen wurden   |
| Query.onDeletePre  | Bevor Objekte über deleteMany/deleteOne() gelöscht werden |
| Query.onDeletePost | Nachdem Objekte über deleteMany/deleteOne() gelöscht wurden |
| Query.onPatchPre   | Bevor Objekte über patchMany/patchOne() gepatcht/aktualisiert werden |
| Query.onPatchPost  | Nachdem Objekte über patchMany/patchOne() gepatcht/aktualisiert wurden |

## Unit-of-Work-Events

Unit-of-Work-Events werden ausgelöst, wenn eine neue Session Änderungen übermittelt.

| Event-Token                  | Beschreibung                                                                                                         |
|------------------------------|----------------------------------------------------------------------------------------------------------------------|
| DatabaseSession.onUpdatePre  | Ausgelöst unmittelbar bevor das Objekt `DatabaseSession` eine Update-Operation an den Datenbank-Datensätzen startet. |
| DatabaseSession.onUpdatePost | Ausgelöst unmittelbar nachdem das Objekt `DatabaseSession` die Update-Operation erfolgreich abgeschlossen hat.       |
| DatabaseSession.onInsertPre  | Ausgelöst unmittelbar bevor das Objekt `DatabaseSession` das Einfügen neuer Datensätze in die Datenbank startet.    |
| DatabaseSession.onInsertPost | Ausgelöst unmittelbar nachdem das Objekt `DatabaseSession` die neuen Datensätze erfolgreich eingefügt hat.           |
| DatabaseSession.onDeletePre  | Ausgelöst unmittelbar bevor das Objekt `DatabaseSession` eine Delete-Operation zum Entfernen von Datensätzen beginnt. |
| DatabaseSession.onDeletePost | Ausgelöst unmittelbar nachdem das Objekt `DatabaseSession` die Delete-Operation abgeschlossen hat.                   |
| DatabaseSession.onCommitPre  | Ausgelöst unmittelbar bevor das Objekt `DatabaseSession` während der Session vorgenommene Änderungen in der Datenbank committet. |