# 트랜잭션

트랜잭션은 select, insert, update, delete와 같은 statement, query, operation을 하나의 작업 단위로 순차적으로 실행하며, 이 단위는 commit 또는 rollback할 수 있습니다.

Deepkit은 공식적으로 지원되는 모든 데이터베이스에 대해 트랜잭션을 지원합니다. 기본적으로 어떤 query나 database session에도 트랜잭션은 사용되지 않습니다. 트랜잭션을 활성화하려면 두 가지 주요 방법이 있습니다: sessions와 callback.

## 세션 트랜잭션

생성하는 각 session마다 새로운 트랜잭션을 시작하고 할당할 수 있습니다. 이는 데이터베이스와 상호작용하는 선호되는 방식으로, Session 객체를 쉽게 전달할 수 있고 해당 session에 의해 생성된 모든 query가 자동으로 그 트랜잭션에 할당됩니다.

일반적인 패턴은 모든 작업을 try-catch 블록으로 감싸고 맨 마지막 줄에서 `commit()`을 실행하는 것입니다(이는 이전 명령이 모두 성공했을 때만 실행됩니다). 그리고 에러가 발생하는 즉시 모든 변경 사항을 되돌리기 위해 catch 블록에서 `rollback()`을 실행합니다.

대체 API(아래 참조)가 있긴 하지만, 모든 트랜잭션은 데이터베이스 session 객체로만 동작합니다. 데이터베이스 session의 unit-of-work에서 열린 변경 사항을 데이터베이스에 커밋하려면 보통 `commit()`을 호출합니다. 트랜잭션 session에서 `commit()`은 보류 중인 모든 변경 사항을 데이터베이스에 커밋할 뿐만 아니라 트랜잭션 자체도 완료("commits")하여 트랜잭션을 종료합니다. 또는 `session.flush()`를 호출해 `commit` 없이, 따라서 트랜잭션을 닫지 않고, 보류 중인 모든 변경 사항을 커밋할 수 있습니다. unit-of-work를 flush하지 않고 트랜잭션만 커밋하려면 `session.commitTransaction()`을 사용하세요.

```typescript
const session = database.createSession();

//이 작업은 새 transaction을 할당하고, 바로 다음 database operation부터 시작합니다.
session.useTransaction();

try {
    //이 query는 트랜잭션 내에서 실행됩니다
    const users = await session.query(User).find();

    await moreDatabaseOperations(session);

    await session.commit();
} catch (error) {
    await session.rollback();
}
```

session에서 `commit()` 또는 `rollback()`이 실행되면 트랜잭션은 해제됩니다. 새로운 트랜잭션으로 계속하려면 `useTransaction()`을 다시 호출해야 합니다.

트랜잭션 session에서 첫 번째 database operation이 실행되는 순간, 할당된 database connection은 현재 session 객체에 고정되고 독점적이 됩니다(sticky). 따라서 이후의 모든 작업은 동일한 connection에서 수행됩니다(즉, 대부분의 데이터베이스에서 동일한 데이터베이스 서버). 트랜잭션 session이 종료될 때(commit 또는 rollback)만 database connection이 다시 해제됩니다. 그러므로 트랜잭션은 필요한 만큼만 짧게 유지하는 것이 좋습니다.

session이 이미 트랜잭션에 연결되어 있다면, `session.useTransaction()` 호출은 항상 동일한 객체를 반환합니다. session에 트랜잭션이 연결되어 있는지 확인하려면 `session.isTransaction()`을 사용하세요.

중첩 트랜잭션은 지원되지 않습니다.

## 트랜잭션 Callback

트랜잭션 session의 대안은 `database.transaction(callback)`입니다.

```typescript
await database.transaction(async (session) => {
    //이 query는 트랜잭션 내에서 실행됩니다
    const users = await session.query(User).find();

    await moreDatabaseOperations(session);
});
```

`database.transaction(callback)` 메서드는 새로운 트랜잭션 session 내에서 비동기 callback을 수행합니다. callback이 성공하면(즉, 에러가 발생하지 않으면) session은 자동으로 커밋됩니다(따라서 해당 트랜잭션이 커밋되고 모든 변경 사항이 flush됩니다). callback이 실패하면 session은 자동으로 `rollback()`을 실행하고 에러를 전파합니다.

## 격리 수준

많은 데이터베이스는 다양한 종류의 트랜잭션을 지원합니다. 트랜잭션 동작을 변경하려면 `useTransaction()`에서 반환된 트랜잭션 객체에 대해 다양한 메서드를 호출할 수 있습니다. 이 트랜잭션 객체의 인터페이스는 사용하는 database adapter에 따라 다릅니다. 예를 들어, MySQL 데이터베이스에서 반환된 트랜잭션 객체는 MongoDB 데이터베이스에서 반환된 것과 다른 옵션을 가집니다. 가능한 옵션 목록을 얻으려면 code completion을 사용하거나 database adapter의 인터페이스를 확인하세요.

```typescript
const database = new Database(new MySQLDatabaseAdapter());

const session = database.createSession();
session.useTransaction().readUncommitted();

try {
    //...작업
    await session.commit();
} catch (error) {
    await session.rollback();
}

//또는
await database.transaction(async (session) => {
    //아직 어떤 database operation도 실행되지 않았다면 동작합니다.
    session.useTransaction().readUncommitted();

    //...작업
});
```

MySQL, PostgreSQL 및 SQLite의 트랜잭션은 기본적으로 동작하지만, MongoDB는 먼저 "replica set"으로 설정해야 합니다.

표준 MongoDB 인스턴스를 replica set으로 변환하려면 다음 공식 문서를 참고하세요:
[Standalone을 Replica Set으로 변환](https://docs.mongodb.com/manual/tutorial/convert-standalone-to-replica-set).