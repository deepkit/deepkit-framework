# API `@deepkit/mongo`

```shell
npm install @deepkit/mongo
```

Deepkit ORM용 독립형 MongoDB 드라이버와 데이터베이스 어댑터입니다.

```typescript
import { MongoDatabaseAdapter } from '@deepkit/mongo';
import { Database } from '@deepkit/orm';

const adapter = new MongoDatabaseAdapter('mongodb://localhost:27017/mydatabase');

const database = new Database(adapter);
```

<api-docs package="@deepkit/mongo"></api-docs>