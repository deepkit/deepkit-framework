# Migrationen

Migrationen sind eine Möglichkeit, Änderungen am Datenbankschema strukturiert und organisiert vorzunehmen. Sie werden als TypeScript-Dateien in einem Verzeichnis gespeichert und können über das Kommandozeilen-Tool ausgeführt werden.

Deepkit ORM-Migrationen sind standardmäßig aktiviert, wenn das Deepkit Framework verwendet wird. 

## Befehle

- `migration:create` - Generiert eine neue Migrationsdatei basierend auf einem Datenbank-Diff
- `migration:pending` - Zeigt ausstehende Migrationsdateien
- `migration:up` - Führt ausstehende Migrationsdateien aus.
- `migration:down` - Führt die Down-Migration aus und macht ältere Migrationsdateien rückgängig

Diese Befehle sind entweder in der Anwendung verfügbar, wenn Sie das `FrameworkModule` importieren, oder über das Kommandozeilen-Tool `deepkit-sql` aus `@deepkit/sql`.

Die [Migrations-Integration des FrameworkModule](../framework/database.md#migration) liest Ihre Datenbanken automatisch (Sie müssen sie als Provider definieren), während Sie bei `deepkit-sql` die TypeScript-Datei angeben müssen, die die Datenbank exportiert. Letzteres ist nützlich, wenn Sie Deepkit ORM eigenständig ohne Deepkit Framework verwenden.

## Eine Migration erstellen

```typescript
//database.ts
import { Database } from '@deepkit/orm';
import { SQLiteDatabaseAdapter } from '@deepkit/sqlite';
import { User } from './models';

export class SQLiteDatabase extends Database {
    name = 'default';
    constructor() {
        super(new SQLiteDatabaseAdapter('/tmp/myapp.sqlite'), [User]);
    }
}
```

```sh
./node_modules/.bin/deepkit-sql migration:create --path database.ts --migrationDir src/migrations
```

In `src/migrations` wird eine neue Migrationsdatei erstellt. 

Die neu erstellte Migrationsdatei enthält nun die Methoden up und down, basierend auf der Differenz zwischen den in Ihrer TypeScript-App definierten Entities und der konfigurierten Datenbank. 
Sie können die Methode up nun nach Bedarf anpassen. Die Methode down wird automatisch auf Basis der Methode up generiert.
Committen Sie diese Datei in Ihr Repository, damit andere Entwickler sie ebenfalls ausführen können.

## Ausstehende Migrationen

```sh
./node_modules/.bin/deepkit-sql migration:pending --path database.ts --migrationDir src/migrations
```

Dies zeigt alle ausstehenden Migrationen. Wenn Sie eine neue Migrationsdatei haben, die noch nicht ausgeführt wurde, wird sie hier aufgelistet.

## Migrationen ausführen

```sh
./node_modules/.bin/deepkit-sql migration:up --path database.ts --migrationDir src/migrations
```

Damit wird die nächste ausstehende Migration ausgeführt. 

## Migrationen rückgängig machen

```sh
./node_modules/.bin/deepkit-sql migration:down --path database.ts --migrationDir src/migrations
```

Damit wird die zuletzt ausgeführte Migration rückgängig gemacht.

## Fake-Migrationen

Angenommen, Sie wollten eine Migration (up oder down) ausführen, aber sie ist fehlgeschlagen. Sie haben das Problem manuell behoben, können die Migration nun jedoch nicht erneut ausführen, da sie bereits ausgeführt ist. Sie können die Option `--fake` verwenden, um die Migration zu faken, sodass sie in der Datenbank als ausgeführt markiert wird, ohne sie tatsächlich auszuführen. So können Sie die nächste ausstehende Migration ausführen.

```sh
./node_modules/.bin/deepkit-sql migration:up --path database.ts --migrationDir src/migrations --fake
```