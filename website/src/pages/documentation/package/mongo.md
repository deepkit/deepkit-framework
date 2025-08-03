# API `@deepkit/mongo`

```shell
npm install @deepkit/mongo
```

Standalone MongoDB driver and a database adapter for Deepkit ORM.

```typescript
import { MongoDatabaseAdapter } from '@deepkit/mongo';
import { Database } from '@deepkit/orm';

const adapter = new MongoDatabaseAdapter('mongodb://localhost:27017/mydatabase');

const database = new Database(adapter);
```

<api-docs package="@deepkit/mongo"></api-docs>
