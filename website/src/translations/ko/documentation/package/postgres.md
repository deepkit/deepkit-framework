# API `@deepkit/postgres`

```shell
npm install @deepkit/postgres
```

```typescript
import { PostgresDatabaseAdapter } from '@deepkit/mongo';
import { Database } from '@deepkit/orm';

const adapter = new PostgresDatabaseAdapter('postgres://user:password@localhost/mydatabase');
// const adapter = new PostgresDatabaseAdapter({ host: 'localhost', database: 'postgres', user: 'postgres' });

const database = new Database(adapter);
```


<api-docs package="@deepkit/postgres"></api-docs>