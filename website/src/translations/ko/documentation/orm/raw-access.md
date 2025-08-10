# Raw 액세스

ORM에서 지원하지 않는 SQL query를 실행해야 하는 등, 데이터베이스에 직접 접근해야 할 때가 자주 있습니다.
이는 `Database` Class의 `raw` Method를 사용하여 수행할 수 있습니다.

```typescript
import { PrimaryKey, AutoIncrement, @entity } from '@deepkit/type';
import { Database } from '@deepkit/orm';
import { sql } from '@deepkit/sql';
import { SqliteDatabaseAdapter } from '@deepkit/sqlite';

@entity.collection('users')
class User {
    id: number & PrimaryKey & AutoIncrement = 0;
    created: Date = new Date;
    constructor(public username: string) {}
}

const database = new Database(new SQLiteDatabaseAdapter(':memory:'), [User]);

const query = 'Pet%';
const rows = await database.raw<User>(sql`SELECT * FROM users WHERE username LIKE ${query}`).find();

const result = await database.raw<{ count: number }>(sql`SELECT count(*) as count FROM users WHERE username LIKE ${query}`).findOne();
console.log('Found', result.count, 'users');
```

SQL query는 `sql` template string tag를 사용해 구성됩니다. 이는 값을 Parameter로 전달할 수 있게 해주는 특별한 template string tag입니다. 이렇게 전달된 Parameter는 자동으로 파싱되어 안전한 prepared statement로 변환됩니다. 이는 SQL injection 공격을 방지하는 데 중요합니다.

컬럼 이름과 같은 동적 identifier를 전달하려면 `identifier`를 사용할 수 있습니다:

```typescript
import { identifier, sql } from '@deepkit/sql';

let column = 'username';
const rows = await database.raw<User>(sql`SELECT * FROM users WHERE ${identifier(column)} LIKE ${query}`).find();
```

SQL adapter의 경우, `raw` Method는 결과를 가져오기 위한 `findOne`, `find` Method를 포함한 `RawQuery`를 반환합니다. UPDATE/DELETE 등과 같이 row를 반환하지 않는 SQL을 실행하려면 `execute`를 사용할 수 있습니다:

```typescript
let username = 'Peter';
await database.raw(sql`UPDATE users SET username = ${username} WHERE id = 1`).execute();
```

`RawQuery`는 database adapter에 맞게 올바르게 포맷팅된 최종 SQL string과 Parameter를 가져오는 것도 지원합니다:

```typescript
const query = database.raw(sql`SELECT * FROM users WHERE username LIKE ${query}`);
console.log(query.sql);
console.log(query.params);
```

이렇게 하면 예를 들어 다른 database client에서 해당 SQL을 실행하는 데 사용할 수 있습니다.

## 타입

`raw`에 어떤 Type이든 전달할 수 있으며, 데이터베이스에서 반환된 결과는 해당 Type으로 자동 변환됩니다. 이는 특히 SQL adapter에서 유용하며, Class를 전달하면 결과가 해당 Class로 자동 변환됩니다.

다만 제한이 있습니다. 이 방식으로는 SQL Join이 지원되지 않습니다. Join을 사용하려면 ORM의 query builder를 사용해야 합니다.

## Mongo

MongoDB adapter는 SQL query 기반이 아니라 Mongo command 기반이기 때문에 동작 방식이 조금 다릅니다.

command는 aggregation pipeline, find query, 또는 write command가 될 수 있습니다.

```typescript
import { MongoDatabaseAdapter } from '@deepkit/mongo';

const database = new Database(MongoDatabaseAdapter('mongodb://localhost:27017/mydatabase'));

// 첫 번째 Argument는 entry point collection, 두 번째는 command의 Return Type입니다
const items = await database.raw<ChatMessage, { count: number }>([
    { $match: { roomId: 'room1' } },
    { $group: { _id: '$userId', count: { $sum: 1 } } },
]).find();
```