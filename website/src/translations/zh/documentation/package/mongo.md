# API `@deepkit/mongo`

```shell
npm install @deepkit/mongo
```

独立的 MongoDB 驱动以及用于 Deepkit ORM 的数据库适配器。

```typescript
import { MongoDatabaseAdapter } from '@deepkit/mongo';
import { Database } from '@deepkit/orm';

const adapter = new MongoDatabaseAdapter('mongodb://localhost:27017/mydatabase');

const database = new Database(adapter);
```

<api-docs package="@deepkit/mongo"></api-docs>