# Zusammengesetzter Primärschlüssel

Ein zusammengesetzter Primärschlüssel bedeutet, dass eine Entity mehrere Primärschlüssel hat, die automatisch zu einem "zusammengesetzten Primärschlüssel" kombiniert werden. Diese Art, eine Datenbank zu modellieren, hat Vor- und Nachteile. Wir sind der Meinung, dass zusammengesetzte Primärschlüssel erhebliche praktische Nachteile mit sich bringen, die ihre Vorteile nicht rechtfertigen; sie sollten daher als Bad Practice betrachtet und vermieden werden. Deepkit ORM unterstützt keine zusammengesetzten Primärschlüssel. In diesem Kapitel erklären wir warum und zeigen (bessere) Alternativen.

## Nachteile

Joins sind nicht trivial. Obwohl sie in RDBMS stark optimiert sind, bedeuten sie in Anwendungen eine konstante Komplexität, die leicht aus dem Ruder laufen und zu Performance-Problemen führen kann. Performance nicht nur im Hinblick auf die Ausführungszeit von Abfragen, sondern auch in Bezug auf Entwicklungszeit.

## Joins

Jeder einzelne Join wird komplizierter, je mehr Felder beteiligt sind. Zwar haben viele Datenbanken Optimierungen implementiert, damit Joins mit mehreren Feldern nicht per se langsamer sind; dennoch muss der Entwickler diese Joins ständig im Detail durchdenken, da das Vergessen von Schlüsseln beispielsweise zu subtilen Fehlern führen kann (der Join funktioniert nämlich auch ohne Angabe aller Schlüssel), und der Entwickler daher die vollständige Struktur des zusammengesetzten Primärschlüssels kennen muss.

## Indizes

Indizes mit mehreren Feldern (also zusammengesetzte Primärschlüssel) leiden unter dem Problem der Feldreihenfolge in Abfragen. Zwar können Datenbanksysteme bestimmte Abfragen optimieren, doch erschweren komplexe Strukturen das Schreiben effizienter Operationen, die alle definierten Indizes korrekt nutzen. Für einen Index mit mehreren Feldern (wie einen zusammengesetzten Primärschlüssel) ist es in der Regel notwendig, die Felder in der richtigen Reihenfolge anzugeben, damit die Datenbank den Index tatsächlich verwendet. Wird die Reihenfolge nicht korrekt angegeben (z. B. in einer WHERE-Klausel), kann das leicht dazu führen, dass die Datenbank den Index gar nicht nutzt und stattdessen einen Full Table Scan ausführt. Zu wissen, welche Datenbank welche Abfrage wie optimiert, ist fortgeschrittenes Wissen, das neue Entwickler üblicherweise nicht haben, das aber erforderlich wird, sobald man mit zusammengesetzten Primärschlüsseln arbeitet, um das Maximum aus der Datenbank herauszuholen und keine Ressourcen zu verschwenden.

## Migrationen

Sobald Sie entscheiden, dass eine bestimmte Entity ein zusätzliches Feld benötigt, um sie eindeutig zu identifizieren (und damit Teil des zusammengesetzten Primärschlüssels wird), müssen alle Entities in Ihrer Datenbank angepasst werden, die Beziehungen zu dieser Entity haben.

Angenommen, Sie haben eine Entity `user` mit zusammengesetztem Primärschlüssel und entscheiden sich, in verschiedenen Tabellen, z. B. in einer Pivot-Tabelle `audit_log`, `groups` und `posts`, einen Foreign Key auf diesen `user` zu verwenden. Sobald Sie den Primärschlüssel von `user` ändern, müssen all diese Tabellen in einer Migration ebenfalls angepasst werden.

Das macht nicht nur Migrationsdateien deutlich komplexer, sondern kann beim Ausführen der Migrationen auch zu erheblicher Downtime führen, da Schemaänderungen üblicherweise entweder einen vollständigen Datenbank-Lock oder zumindest einen Table Lock erfordern. Je mehr Tabellen von einer großen Änderung wie einer Index-Änderung betroffen sind, desto länger dauert die Migration. Und je größer eine Tabelle ist, desto länger dauert die Migration.
Betrachten Sie die Tabelle `audit_log`. Solche Tabellen haben in der Regel viele Datensätze (Millionen o. ä.), und Sie müssen sie im Rahmen einer Schemaänderung anfassen – nur weil Sie sich entschieden haben, einen zusammengesetzten Primärschlüssel zu verwenden und dem Primärschlüssel von `user` ein zusätzliches Feld hinzuzufügen. Abhängig von der Größe all dieser Tabellen macht das Migrationsänderungen entweder unnötig teurer oder in manchen Fällen so teuer, dass eine Änderung des Primärschlüssels von `user` finanziell nicht mehr zu rechtfertigen ist. Das führt üblicherweise zu Workarounds (z. B. dem Hinzufügen eines Unique Index zur user-Tabelle), die technische Schulden erzeugen und früher oder später auf der Legacy-Liste landen.

Bei großen Projekten kann das zu enormer Downtime (von Minuten bis Stunden) führen und manchmal sogar zur Einführung eines völlig neuen Migrations-Abstraktionssystems, das im Wesentlichen Tabellen kopiert, Datensätze in Ghost Tables einfügt und Tabellen nach der Migration hin- und herschiebt. Diese zusätzliche Komplexität wird wiederum jeder Entity auferlegt, die eine Beziehung zu einer anderen Entity mit zusammengesetztem Primärschlüssel hat, und sie wird umso größer, je größer Ihre Datenbankstruktur wird. Das Problem verschärft sich, ohne dass es eine Möglichkeit gibt, es zu lösen (außer den zusammengesetzten Primärschlüssel vollständig zu entfernen).

## Auffindbarkeit

Wenn Sie Datenbankadministrator oder Data Engineer/Scientist sind, arbeiten Sie üblicherweise direkt auf der Datenbank und explorieren die Daten bei Bedarf. Bei zusammengesetzten Primärschlüsseln muss jeder Nutzer, der direkt SQL schreibt, den korrekten Primärschlüssel aller beteiligten Tabellen kennen (samt Spaltenreihenfolge, um korrekte Index-Optimierungen zu erhalten). Dieser zusätzliche Overhead erschwert nicht nur die Datenexploration, Berichtserstellung usw., sondern kann auch zu Fehlern in älterem SQL führen, wenn ein zusammengesetzter Primärschlüssel plötzlich geändert wird. Das alte SQL ist vermutlich weiterhin gültig und läuft problemlos, liefert aber plötzlich falsche Ergebnisse, weil im Join das neue Feld des zusammengesetzten Primärschlüssels fehlt. Es ist deutlich einfacher, nur einen Primärschlüssel zu haben. Das erleichtert das Auffinden von Daten und stellt sicher, dass alte SQL-Abfragen weiterhin korrekt funktionieren, wenn Sie sich z. B. entscheiden, die eindeutige Identifikation eines User-Objekts zu ändern.

## Refactoring

Sobald in einer Entity ein zusammengesetzter Primärschlüssel verwendet wird, kann das Refactoring des Schlüssels zu erheblich mehr zusätzlichem Refactoring führen. Da eine Entity mit zusammengesetztem Primärschlüssel typischerweise kein einzelnes eindeutiges Feld hat, müssen alle Filter und Verknüpfungen alle Werte des zusammengesetzten Schlüssels enthalten. Das bedeutet meist, dass sich der Code darauf verlässt, den zusammengesetzten Primärschlüssel zu kennen, sodass alle Felder verfügbar sein müssen (z. B. für URLs wie user:key1:key2). Sobald dieser Schlüssel geändert wird, müssen alle Stellen, an denen dieses Wissen explizit verwendet wird – etwa URLs, individuelles SQL und andere Orte – neu geschrieben werden.

Während ORMs Joins typischerweise automatisch erstellen, ohne die Werte manuell anzugeben, können sie Refactorings für alle anderen Anwendungsfälle wie URL-Strukturen oder individuelles SQL nicht automatisch abdecken – und schon gar nicht für Orte, an denen das ORM überhaupt nicht verwendet wird, etwa in Reporting-Systemen und allen externen Systemen.

## ORM-Komplexität

Mit der Unterstützung zusammengesetzter Primärschlüssel steigt die Komplexität des Codes eines leistungsfähigen ORMs wie Deepkit ORM enorm. Nicht nur Code und Wartung werden komplexer und damit teurer, es gibt auch mehr Edge Cases von Nutzern, die behoben und gepflegt werden müssen. Die Komplexität der Query-Schicht, der Change-Detection, des Migrationssystems, des internen Relationship-Trackings usw. nimmt erheblich zu. Die Gesamtkosten, die mit dem Aufbau und der Unterstützung eines ORMs mit zusammengesetzten Primärschlüsseln verbunden sind, sind unter Berücksichtigung aller Faktoren zu hoch und nicht zu rechtfertigen – weshalb Deepkit sie nicht unterstützt.

## Vorteile

Abgesehen davon haben zusammengesetzte Primärschlüssel auch Vorteile, wenn auch sehr oberflächliche. Durch die Verwendung möglichst weniger Indizes pro Tabelle wird das Schreiben (Insert/Update) von Daten effizienter, da weniger Indizes gepflegt werden müssen. Zudem wird die Struktur des Modells etwas schlanker (da es üblicherweise eine Spalte weniger hat). Der Unterschied zwischen einem sequentiell angeordneten, automatisch inkrementierenden Primärschlüssel und einem nicht-inkrementierenden Primärschlüssel ist heutzutage jedoch völlig vernachlässigbar, da Speicherplatz günstig ist und der Vorgang in der Regel eine "append-only"-Operation ist, die sehr schnell ist.

Es kann sicherlich einige Edge Cases geben (und für ein paar sehr spezifische Datenbanksysteme), in denen es anfänglich besser erscheint, mit zusammengesetzten Primärschlüsseln zu arbeiten. Aber selbst in diesen Systemen könnte es insgesamt sinnvoller sein (unter Berücksichtigung aller Kosten), sie nicht zu verwenden und auf eine andere Strategie umzusteigen.

## Alternative

Eine Alternative zu zusammengesetzten Primärschlüsseln besteht darin, einen einzelnen automatisch inkrementierenden numerischen Primärschlüssel zu verwenden, üblicherweise "id" genannt, und den zusammengesetzten Primärschlüssel in einen eindeutigen Index mit mehreren Feldern zu verlagern. Je nach verwendetem Primärschlüssel (abhängig von der erwarteten Anzahl von Zeilen) verwendet die "id" entweder 4 oder 8 Byte pro Datensatz.

Mit dieser Strategie sind Sie nicht mehr gezwungen, über die oben beschriebenen Probleme nachzudenken und eine Lösung zu finden, was die Kosten für immer größer werdende Projekte enorm reduziert.

Die Strategie bedeutet konkret, dass jede Entity ein "id"-Feld hat, üblicherweise ganz am Anfang, und dieses Feld wird dann standardmäßig zur eindeutigen Identifikation von Zeilen und in Joins verwendet.

```typescript
class User {
    id: number & PrimaryKey & AutoIncrement = 0;

    constructor(public username: string) {}
}
```

Als Alternative zu einem zusammengesetzten Primärschlüssel würden Sie stattdessen einen eindeutigen Index über mehrere Felder verwenden.

```typescript
@entity.index(['tenancyId', 'username'], {unique: true})
class User {
    id: number & PrimaryKey & AutoIncrement = 0;

    constructor(
        public tenancyId: number,
        public username: string,
    ) {}
}
```

Deepkit ORM unterstützt automatisch inkrementierende Primärschlüssel, auch für MongoDB. Dies ist die bevorzugte Methode zur Identifikation von Datensätzen in Ihrer Datenbank. Für MongoDB können Sie jedoch auch die ObjectId (`_id: MongoId & PrimaryKey = ''`) als einfachen Primärschlüssel verwenden. Eine Alternative zum numerischen, automatisch inkrementierenden Primärschlüssel ist eine UUID, die genauso gut funktioniert (hat aber leicht andere Performance-Eigenschaften, da die Indexierung teurer ist).

## Zusammenfassung

Zusammengesetzte Primärschlüssel bedeuten im Wesentlichen, dass alle zukünftigen Änderungen und die praktische Nutzung ab dem Zeitpunkt ihrer Einführung deutlich höhere Kosten verursachen. Während es anfangs wie eine saubere Architektur wirkt (weil man eine Spalte weniger hat), führt es zu erheblichen praktischen Kosten, sobald das Projekt tatsächlich entwickelt wird, und die Kosten steigen weiter, je größer das Projekt wird.

Betrachtet man die Asymmetrien zwischen Nutzen und Nachteilen, wird klar, dass zusammengesetzte Primärschlüssel in den meisten Fällen nicht zu rechtfertigen sind. Die Kosten sind deutlich größer als der Nutzen – nicht nur für Sie als Nutzer, sondern auch für uns als Autor und Maintainer des ORM-Codes. Aus diesem Grund unterstützt Deepkit ORM keine zusammengesetzten Primärschlüssel.