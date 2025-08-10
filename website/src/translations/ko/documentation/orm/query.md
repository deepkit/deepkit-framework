# 쿼리

쿼리는 데이터베이스에서 데이터를 조회하거나 수정하는 방법을 기술하는 객체입니다. 쿼리를 기술하는 여러 Method와 이를 실행하는 종료 Method들을 갖습니다. 데이터베이스 adapter는 데이터베이스별 기능을 지원하기 위해 다양한 방식으로 Query API를 확장할 수 있습니다.

`Database.query(T)` 또는 `Session.query(T)`를 사용해 쿼리를 생성할 수 있습니다. 성능 향상을 위해 Session 사용을 권장합니다.

```typescript
@entity.name('user')
class User {
    id: number & PrimaryKey & AutoIncrement = 0;
    created: Date = new Date;
    birthdate?: Date;
    visits: number = 0;

    constructor(public username: string) {
    }
}

const database = new Database(...);

//[ { username: 'User1' }, { username: 'User2' }, { username: 'User2' } ]
const users = await database.query(User).select('username').find();
```

## 필터

필터를 적용하여 결과 집합을 제한할 수 있습니다.

```typescript
//간단한 필터
const users = await database.query(User).filter({name: 'User1'}).find();

//여러 필터, 모두 AND
const users = await database.query(User).filter({name: 'User1', id: 2}).find();

//범위 필터: $gt, $lt, $gte, $lte (초과, 미만, 이상, 이하)
//WHERE created < NOW()와 동일
const users = await database.query(User).filter({created: {$lt: new Date}}).find();
//WHERE id > 500과 동일
const users = await database.query(User).filter({id: {$gt: 500}}).find();
//WHERE id >= 500과 동일
const users = await database.query(User).filter({id: {$gte: 500}}).find();

//집합 필터: $in, $nin (in, not in)
//WHERE id IN (1, 2, 3)과 동일
const users = await database.query(User).filter({id: {$in: [1, 2, 3]}}).find();

//정규식 필터
const users = await database.query(User).filter({username: {$regex: /User[0-9]+/}}).find();

//그룹화: $and, $nor, $or
//WHERE (username = 'User1') OR (username = 'User2')와 동일
const users = await database.query(User).filter({
    $or: [{username: 'User1'}, {username: 'User2'}]
}).find();


//중첩 그룹화
//WHERE username = 'User1' OR (username = 'User2' and id > 0)와 동일
const users = await database.query(User).filter({
    $or: [{username: 'User1'}, {username: 'User2', id: {$gt: 0}}]
}).find();


//중첩 그룹화
//WHERE username = 'User1' AND (created < NOW() OR id > 0)와 동일
const users = await database.query(User).filter({
    $and: [{username: 'User1'}, {$or: [{created: {$lt: new Date}, id: {$gt: 0}}]}]
}).find();
```

### 동등 (Equal)

### 더 큼 / 더 작음 (Greater / Smaller)

### RegExp

### 그룹화 AND/OR

### In

## Select

데이터베이스에서 받을 필드를 좁히기 위해 `select('field1')`을 사용할 수 있습니다.

```typescript
const user = await database.query(User).select('username').findOne();
const user = await database.query(User).select('id', 'username').findOne();
```

`select`를 사용해 필드를 좁히는 즉시 결과는 더 이상 엔티티의 인스턴스가 아니라 단순 객체 리터럴이라는 점에 유의하세요.

```
const user = await database.query(User).select('username').findOne();
user instanceof User; //false
```

## 정렬 (Order)

`orderBy(field, order)`로 항목의 정렬 순서를 변경할 수 있습니다.
`orderBy`는 여러 번 실행하여 정렬을 점점 더 세밀하게 할 수 있습니다.

```typescript
const users = await session.query(User).orderBy('created', 'desc').find();
const users = await session.query(User).orderBy('created', 'asc').find();
```

## 페이지네이션 (Pagination)

`itemsPerPage()`와 `page()` 메서드를 사용해 결과를 페이지네이션할 수 있습니다. 페이지는 1부터 시작합니다.

```typescript
const users = await session.query(User).itemsPerPage(50).page(1).find();
```

대체 Method인 `limit`과 `skip`을 사용해 수동으로 페이지네이션할 수도 있습니다.

```typescript
const users = await session.query(User).limit(5).skip(10).find();
```

[#database-join]
## 조인 (Join)

기본적으로 엔티티의 Reference는 쿼리에 포함되지도 않고 로드되지도 않습니다. Reference를 로드하지 않고 쿼리에 조인을 포함하려면 `join()`(LEFT JOIN) 또는 `innerJoin()`을 사용하세요. 쿼리에 조인을 포함하고 Reference를 로드하려면 `joinWith()` 또는 `innerJoinWith()`를 사용하세요.

다음의 모든 예제는 아래 모델 스키마를 가정합니다:

```typescript
@entity.name('group')
class Group {
    id: number & PrimaryKey & AutoIncrement = 0;
    created: Date = new Date;

    constructor(public username: string) {
    }
}

@entity.name('user')
class User {
    id: number & PrimaryKey & AutoIncrement = 0;
    created: Date = new Date;

    group?: Group & Reference;

    constructor(public username: string) {
    }
}
```

```typescript
//그룹이 할당된 사용자만 선택 (INNER JOIN)
const users = await session.query(User).innerJoin('group').find();
for (const user of users) {
    user.group; //error, reference가 로드되지 않았기 때문
}
```

```typescript
//그룹이 할당된 사용자만 선택 (INNER JOIN)하고 relation 로드
const users = await session.query(User).innerJoinWith('group').find();
for (const user of users) {
    user.group.name; //동작함
}
```

조인 쿼리를 수정하려면 동일한 Method에 `use` prefix를 붙여 사용하세요: `useJoin`, `useInnerJoin`, `useJoinWith`, `useInnerJoinWith`. 조인 쿼리 수정을 종료하고 상위 쿼리로 돌아가려면 `end()`를 사용하세요.

```typescript
//이름이 'admins'인 그룹이 할당된 사용자만 선택 (INNER JOIN)
const users = await session.query(User)
    .useInnerJoinWith('group')
        .filter({name: 'admins'})
        .end()  // 상위 쿼리로 돌아감
    .find();

for (const user of users) {
    user.group.name; //항상 admin
}
```

## 집계 (Aggregation)

집계 Method를 사용하면 레코드를 count하고 필드를 집계할 수 있습니다.

다음 예제는 아래 모델 스키마를 가정합니다:

```typescript
@entity.name('file')
class File {
    id: number & PrimaryKey & AutoIncrement = 0;
    created: Date = new Date;

    downloads: number = 0;

    category: string = 'none';

    constructor(public path: string & Index) {
    }
}
```

`groupBy`는 지정된 필드로 결과를 그룹화합니다.

```typescript
await database.persist(
    cast<File>({path: 'file1', category: 'images'}),
    cast<File>({path: 'file2', category: 'images'}),
    cast<File>({path: 'file3', category: 'pdfs'})
);

//[ { category: 'images' }, { category: 'pdfs' } ]
await session.query(File).groupBy('category').find();
```

여러 집계 Method가 있습니다: `withSum`, `withAverage`, `withCount`, `withMin`, `withMax`, `withGroupConcat`. 각각 첫 번째 인자로 필드 이름이 필요하며, 별칭을 변경하기 위한 두 번째 인자는 선택 사항입니다.

```typescript
// 먼저 일부 레코드를 업데이트해봅시다:
await database.query(File).filter({path: 'images/file1'}).patchOne({$inc: {downloads: 15}});
await database.query(File).filter({path: 'images/file2'}).patchOne({$inc: {downloads: 5}});

//[{ category: 'images', downloads: 20 },{ category: 'pdfs', downloads: 0 }]
await session.query(File).groupBy('category').withSum('downloads').find();

//[{ category: 'images', downloads: 10 },{ category: 'pdfs', downloads: 0 }]
await session.query(File).groupBy('category').withAverage('downloads').find();

//[ { category: 'images', amount: 2 }, { category: 'pdfs', amount: 1 } ]
await session.query(File).groupBy('category').withCount('id', 'amount').find();
```

## Returning

`patch`와 `delete`를 통해 변경이 있을 때 `returning`으로 추가 필드를 요청할 수 있습니다.

주의: 모든 데이터베이스 adapter가 필드를 원자적으로 반환하지는 않습니다. 데이터 일관성을 위해 트랜잭션을 사용하세요.

```typescript
await database.query(User).patchMany({visits: 0});

//{ modified: 1, returning: { visits: [ 5 ] }, primaryKeys: [ 1 ] }
const result = await database.query(User)
    .filter({username: 'User1'})
    .returning('username', 'visits')
    .patchOne({$inc: {visits: 5}});
```

## Find

지정된 필터와 일치하는 항목의 배열을 반환합니다.

```typescript
const users: User[] = await database.query(User).filter({username: 'Peter'}).find();
```

## FindOne

지정된 필터와 일치하는 항목을 반환합니다.
항목을 찾지 못하면 `ItemNotFound` error가 발생합니다.

```typescript
const users: User = await database.query(User).filter({username: 'Peter'}).findOne();
```

## FindOneOrUndefined

지정된 필터와 일치하는 항목을 반환합니다.
항목을 찾지 못하면 undefined가 반환됩니다.

```typescript
const query = database.query(User).filter({username: 'Peter'});
const users: User|undefined = await query.findOneOrUndefined();
```

## FindField

지정된 필터와 일치하는 특정 필드의 목록을 반환합니다.

```typescript
const usernames: string[] = await database.query(User).findField('username');
```

## FindOneField

지정된 필터와 일치하는 특정 필드의 값을 반환합니다.
항목을 찾지 못하면 `ItemNotFound` error가 발생합니다.

```typescript
const username: string = await database.query(User).filter({id: 3}).findOneField('username');
```

## Patch

Patch는 쿼리에 기술된 레코드를 패치하는 변경 쿼리입니다. `patchOne`과 `patchMany`는 쿼리를 종료하고 패치를 실행합니다.

`patchMany`는 지정된 필터와 일치하는 데이터베이스의 모든 레코드를 변경합니다. 필터가 설정되지 않으면 전체 테이블이 변경됩니다. 한 번에 하나의 항목만 변경하려면 `patchOne`을 사용하세요.

```typescript
await database.query(User).filter({username: 'Peter'}).patch({username: 'Peter2'});

await database.query(User).filter({username: 'User1'}).patchOne({birthdate: new Date});
await database.query(User).filter({username: 'User1'}).patchOne({$inc: {visits: 1}});

await database.query(User).patchMany({visits: 0});
```

## Delete

`deleteMany`는 지정된 필터와 일치하는 모든 항목을 데이터베이스에서 삭제합니다.
필터가 설정되지 않으면 전체 테이블이 삭제됩니다. 한 번에 하나의 항목만 삭제하려면 `deleteOne`을 사용하세요.

```typescript
const result = await database.query(User)
    .filter({visits: 0})
    .deleteMany();

const result = await database.query(User).filter({id: 4}).deleteOne();
```

## Has

데이터베이스에 최소 한 개의 항목이 존재하는지 여부를 반환합니다.

```typescript
const userExists: boolean = await database.query(User).filter({username: 'Peter'}).has();
```

## Count

항목의 개수를 반환합니다.

```typescript
const userCount: number = await database.query(User).count();
```

## Lift

쿼리를 Lift한다는 것은 새로운 기능을 추가한다는 의미입니다. 이는 보통 플러그인이나 복잡한 아키텍처에서 더 큰 쿼리 Class를 여러 개의 편리하고 재사용 가능한 Class로 분할하기 위해 사용됩니다.

```typescript
import { FilterQuery, Query } from '@deepkit/orm';

class UserQuery<T extends {birthdate?: Date}> extends Query<T>  {
    hasBirthday() {
        const start = new Date();
        start.setHours(0,0,0,0);
        const end = new Date();
        end.setHours(23,59,59,999);

        return this.filter({$and: [{birthdate: {$gte: start}}, {birthdate: {$lte: end}}]} as FilterQuery<T>);
    }
}

await session.query(User).lift(UserQuery).hasBirthday().find();
```