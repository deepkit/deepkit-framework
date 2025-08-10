# 이벤트

이벤트는 Deepkit ORM에 hook 하여 강력한 플러그인을 작성할 수 있는 방법입니다. 이벤트에는 두 가지
카테고리가 있습니다: Query 이벤트와 Unit-of-Work 이벤트. 플러그인 작성자는 일반적으로 둘 다를 사용하여
데이터를 조작하는 두 가지 방식을 모두 지원합니다.

이벤트는 `Database.listen`을 통해 event token에 등록됩니다. 수명이 짧은 이벤트 리스너는 세션에도
등록할 수 있습니다.

```typescript
import { Query, Database } from '@deepkit/orm';

const database = new Database(...);
database.listen(Query.onFetch, async (event) => {
});

const session = database.createSession();

//이 특정 세션에서만 실행됩니다
session.eventDispatcher.listen(Query.onFetch, async (event) => {
});
```

## Query 이벤트

Query 이벤트는 `Database.query()` 또는 `Session.query()`를 통해 query가 실행될 때 트리거됩니다.

각 이벤트에는 entity 타입, query 자체, 데이터베이스 세션 등 고유한 추가 속성이 있습니다.
`Event.query`에 새로운 query를 설정하여 query를 override할 수 있습니다.

```typescript
import { Query, Database } from '@deepkit/orm';

const database = new Database(...);

const unsubscribe = database.listen(Query.onFetch, async event => {
    //사용자의 쿼리를 덮어써서 다른 것이 실행되도록 합니다.
    event.query = event.query.filterField('fieldName', 123);
});

//hook을 제거하려면 unsubscribe를 호출하세요
unsubscribe();
```

"Query"에는 여러 Event token이 있습니다:

| Event-Token        | 설명                                                         |
|--------------------|--------------------------------------------------------------|
| Query.onFetch      | find()/findOne()/등을 통해 객체가 조회되었을 때              |
| Query.onDeletePre  | deleteMany/deleteOne()를 통해 객체가 삭제되기 전             |
| Query.onDeletePost | deleteMany/deleteOne()를 통해 객체가 삭제된 후               |
| Query.onPatchPre   | patchMany/patchOne()를 통해 객체가 패치/업데이트되기 전      |
| Query.onPatchPost  | patchMany/patchOne()를 통해 객체가 패치/업데이트된 후        |

## Unit Of Work 이벤트

Unit-of-Work 이벤트는 새로운 세션이 변경 사항을 제출할 때 트리거됩니다.

| Event-Token                  | 설명                                                                                         |
|------------------------------|----------------------------------------------------------------------------------------------|
| DatabaseSession.onUpdatePre  | `DatabaseSession` 객체가 데이터베이스 레코드에 대한 업데이트 작업을 시작하기 직전에 트리거됩니다. |
| DatabaseSession.onUpdatePost | `DatabaseSession` 객체가 업데이트 작업을 성공적으로 완료한 직후 트리거됩니다.                   |
| DatabaseSession.onInsertPre  | `DatabaseSession` 객체가 새 레코드를 데이터베이스에 삽입하기 시작하기 직전에 트리거됩니다.       |
| DatabaseSession.onInsertPost | `DatabaseSession` 객체가 새 레코드를 성공적으로 삽입한 직후 트리거됩니다.                       |
| DatabaseSession.onDeletePre  | `DatabaseSession` 객체가 데이터베이스에서 레코드를 삭제하기 시작하기 직전에 트리거됩니다.        |
| DatabaseSession.onDeletePost | `DatabaseSession` 객체가 삭제 작업을 완료한 직후 트리거됩니다.                                 |
| DatabaseSession.onCommitPre  | `DatabaseSession` 객체가 세션 동안 이루어진 변경 사항을 데이터베이스에 커밋하기 직전에 트리거됩니다. |