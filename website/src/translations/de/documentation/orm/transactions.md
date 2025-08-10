# Transaktionen

Eine Transaktion ist eine sequentielle Gruppe von Statements, Queries oder Operationen wie select, insert, update oder delete, die als eine einzige Unit-of-Work ausgeführt wird und die entweder committed oder zurückgerollt (rolled back) werden kann.

Deepkit unterstützt Transaktionen für alle offiziell unterstützten Datenbanken. Standardmäßig werden für keine Abfrage (Query) oder Datenbank-Session Transaktionen verwendet. Um Transaktionen zu aktivieren, gibt es zwei Hauptmethoden: Sessions und Callback.

## Session-Transaktionen

Sie können für jede erstellte Session eine neue Transaktion starten und zuweisen. Dies ist die bevorzugte Art der Interaktion mit der Datenbank, da Sie das Session-Objekt leicht weitergeben können und alle von dieser Session instanziierten Queries automatisch ihrer Transaktion zugeordnet werden.

Ein typisches Muster ist, alle Operationen in einen try-catch-Block zu kapseln und `commit()` in der allerletzten Zeile auszuführen (das nur ausgeführt wird, wenn alle vorherigen Befehle erfolgreich waren) und `rollback()` im catch-Block, um alle Änderungen zurückzurollen, sobald ein Fehler auftritt.

Obwohl es eine alternative API gibt (siehe unten), funktionieren alle Transaktionen nur mit Datenbank-Session-Objekten. Um offene Änderungen der Unit-of-Work in einer Datenbank-Session an die Datenbank zu committen, wird normalerweise `commit()` aufgerufen. In einer transaktionalen Session committet `commit()` nicht nur alle ausstehenden Änderungen an die Datenbank, sondern schließt auch die Transaktion ab ("commits" sie) und beendet damit die Transaktion. Alternativ können Sie `session.flush()` aufrufen, um alle ausstehenden Änderungen ohne `commit` und somit ohne die Transaktion zu schließen zu committen. Um eine Transaktion zu committen, ohne die Unit-of-Work zu flushen, verwenden Sie `session.commitTransaction()`.

```typescript
const session = database.createSession();

//weist eine neue Transaktion zu und startet sie mit der nächsten Datenbankoperation.
session.useTransaction();

try {
    //diese Query wird in der Transaktion ausgeführt
    const users = await session.query(User).find();

    await moreDatabaseOperations(session);

    await session.commit();
} catch (error) {
    await session.rollback();
}
```

Sobald `commit()` oder `rollback()` in einer Session ausgeführt wurde, wird die Transaktion freigegeben. Sie müssen dann erneut `useTransaction()` aufrufen, wenn Sie in einer neuen Transaktion fortfahren möchten.

Bitte beachten Sie, dass sobald die erste Datenbankoperation in einer transaktionalen Session ausgeführt wird, die zugewiesene Datenbankverbindung fest und exklusiv dem aktuellen Session-Objekt zugeordnet wird (sticky). Somit werden alle nachfolgenden Operationen über dieselbe Verbindung (und damit in den meisten Datenbanken auf demselben Datenbankserver) ausgeführt. Erst wenn die transaktionale Session beendet wird (commit oder rollback), wird die Datenbankverbindung wieder freigegeben. Es wird daher empfohlen, eine Transaktion nur so kurz wie nötig zu halten.

Wenn eine Session bereits mit einer Transaktion verbunden ist, gibt ein Aufruf von `session.useTransaction()` immer dasselbe Objekt zurück. Verwenden Sie `session.isTransaction()`, um zu prüfen, ob der Session eine Transaktion zugeordnet ist.

Verschachtelte Transaktionen werden nicht unterstützt.

## Transaktions-Callback

Eine Alternative zu transaktionalen Sessions ist `database.transaction(callback)`.

```typescript
await database.transaction(async (session) => {
    //diese Query wird in der Transaktion ausgeführt
    const users = await session.query(User).find();

    await moreDatabaseOperations(session);
});
```

Die Methode `database.transaction(callback)` führt einen asynchronen Callback innerhalb einer neuen transaktionalen Session aus. Wenn der Callback erfolgreich ist (d. h. kein Fehler geworfen wird), wird die Session automatisch committed (und damit ihre Transaktion committed und alle Änderungen geflusht). Wenn der Callback fehlschlägt, führt die Session automatisch `rollback()` aus und der Fehler wird propagiert.

## Isolationsebenen

Viele Datenbanken unterstützen unterschiedliche Arten von Transaktionen. Um das Transaktionsverhalten zu ändern, können Sie verschiedene Methoden für das von `useTransaction()` zurückgegebene Transaktionsobjekt aufrufen. Das Interface dieses Transaktionsobjekts hängt vom verwendeten Datenbank-Adapter ab. Das von einer MySQL-Datenbank zurückgegebene Transaktionsobjekt hat beispielsweise andere Optionen als das von einer MongoDB-Datenbank zurückgegebene. Verwenden Sie Code Completion oder sehen Sie sich das Interface des Datenbank-Adapters an, um eine Liste möglicher Optionen zu erhalten.

```typescript
const database = new Database(new MySQLDatabaseAdapter());

const session = database.createSession();
session.useTransaction().readUncommitted();

try {
    //...Operationen
    await session.commit();
} catch (error) {
    await session.rollback();
}

//oder
await database.transaction(async (session) => {
    //dies funktioniert, solange noch keine Datenbankoperation ausgeführt wurde.
    session.useTransaction().readUncommitted();

    //...Operationen
});
```

Während Transaktionen für MySQL, PostgreSQL und SQLite standardmäßig funktionieren, müssen Sie MongoDB zuerst als "Replica Set" einrichten.

Um eine Standard-MongoDB-Instanz in ein Replica Set zu konvertieren, lesen Sie bitte den Link zur offiziellen Dokumentation:
[Eine Standalone-Instanz in ein Replica Set umwandeln](https://docs.mongodb.com/manual/tutorial/convert-standalone-to-replica-set).