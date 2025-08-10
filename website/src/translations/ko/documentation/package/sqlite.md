# API `@deepkit/sqlite`

```shell
npm install @deepkit/sqlite
```

```typescript
import { SQLiteDatabaseAdapter } from '@deepkit/sqlite';
import { Database } from '@deepkit/orm';

const adapter = new SQLiteDatabaseAdapter(':memory');

const database = new Database(adapter);
```

<api-docs package="@deepkit/sqlite"></api-docs>