# データベースファイルシステム

このアダプターにより、データベース ORM をファイルシステムのバックエンドとして使用できます。これは、すべてのファイルとフォルダーがデータベースに保存されることを意味します。

```sh
npm install @deepkit/filesystem-database @deepkit/orm
```

## 使用方法

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