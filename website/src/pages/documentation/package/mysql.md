# API `@deepkit/mysql`

```shell
npm install @deepkit/mysql
```

```typescript
import { MySQLDatabaseAdapter } from '@deepkit/mysql';
import { Database } from '@deepkit/orm';

const adapter = new PostgresDatabaseAdapter('mysql://user:password@localhost/mydatabase');
// const adapter = new MySQLDatabaseAdapter({host: 'localhost', port: 3306});

const database = new Database(adapter);
```

<api-docs package="@deepkit/mysql"></api-docs>
