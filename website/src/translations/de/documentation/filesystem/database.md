# Datenbank-Dateisystem

Dieser Adapter ermöglicht es, eine Datenbank-ORM als Dateisystem-Backend zu verwenden. Das bedeutet, dass alle Dateien und Ordner in der Datenbank gespeichert werden.

```sh
npm install @deepkit/filesystem-database @deepkit/orm
```

## Verwendung

```typescript
import { Filesystem } from '@deepkit/filesystem';
import { FilesystemDatabaseAdapter } from '@deepkit/filesystem-database';

const database = new Database(new MemoryDatabaseAdapter());
// const database = new Database(new PostgresDatabaseAdapter());
// const database = new Database(new MongoDatabaseAdapter());
// const database = new Database(new MysqlDatabaseAdapter());
// const database = new Database(new SQLiteDatabaseAdapter());

const adapter = new FilesystemDatabaseAdapter({ database });
const filesystem = new Filesystem(adapter);
```