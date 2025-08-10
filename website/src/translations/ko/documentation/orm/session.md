# 세션 / Unit Of Work

세션은 일종의 Unit Of Work와 같습니다. `commit()`이 호출될 때마다 당신이 하는 모든 작업을 추적하고 변경 사항을 자동으로 기록합니다. 세션은 여러 쿼리를 묶어 매우 빠르게 처리하기 때문에 데이터베이스에 변경을 수행하는 데 선호되는 방식입니다. 세션은 매우 가벼워서 예를 들어 request-response 라이프사이클에서 쉽게 생성할 수 있습니다.

```typescript
import { SQLiteDatabaseAdapter } from '@deepkit/sqlite';
import { entity, PrimaryKey, AutoIncrement } from '@deepkit/type';
import { Database } from '@deepkit/orm';

async function main() {

    @entity.name('user')
    class User {
        id: number & PrimaryKey & AutoIncrement = 0;
        created: Date = new Date;

        constructor(public name: string) {
        }
    }

    const database = new Database(new SQLiteDatabaseAdapter(':memory:'), [User]);
    await database.migrate();

    const session = database.createSession();
    session.add(new User('User1'), new User('User2'), new User('User3'));

    await session.commit();

    const users = await session.query(User).find();
    console.log(users);
}

main();
```

`session.add(T)`로 세션에 새 인스턴스를 추가하거나 `session.remove(T)`로 기존 인스턴스를 제거하세요. Session 객체 사용을 마쳤다면, 가비지 컬렉터가 제거할 수 있도록 모든 곳에서 참조를 해제(dereference)하면 됩니다.

Session 객체를 통해 가져온 entity 인스턴스의 변경 사항은 자동으로 감지됩니다.

```typescript
const users = await session.query(User).find();
for (const user of users) {
    user.name += ' changed';
}

await session.commit();//모든 사용자를 저장합니다
```

## Identity Map

세션은 데이터베이스 엔트리마다 단 하나의 JavaScript 객체만 존재하도록 보장하는 Identity Map을 제공합니다. 예를 들어, 동일한 세션 내에서 `session.query(User).find()`를 두 번 실행하면 두 개의 서로 다른 배열을 받지만, 그 안에는 동일한 entity 인스턴스들이 들어 있습니다.

`session.add(entity1)`로 새로운 entity를 추가하고 다시 조회하면 정확히 동일한 entity 인스턴스 `entity1`을 얻게 됩니다.

중요: 세션을 사용하기 시작하면 `database.query` 대신 `session.query` Method를 사용해야 합니다. Identity mapping 기능은 세션 쿼리에서만 활성화됩니다.

## 변경 감지

## Request/Response