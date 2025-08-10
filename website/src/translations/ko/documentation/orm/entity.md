# 엔터티

엔터티는 클래스 또는 객체 리터럴(인터페이스)이며 항상 기본 키를 가집니다.
엔터티는 `@deepkit/type`의 타입 애너테이션을 사용해 필요한 모든 정보를 데코레이션합니다. 예를 들어, 기본 키와 다양한 필드 및 그 검증 제약을 정의합니다. 이 필드들은 일반적으로 테이블 또는 컬렉션인 데이터베이스 구조를 반영합니다.

`Mapped<'name'>`와 같은 특수 타입 애너테이션을 통해 필드 이름을 데이터베이스의 다른 이름으로 매핑할 수도 있습니다.

## 클래스

```typescript
import { entity, PrimaryKey, AutoIncrement, Unique, MinLength, MaxLength } from '@deepkit/type';

@entity.name('user')
class User {
    id: number & PrimaryKey & AutoIncrement = 0;
    created: Date = new Date;
    firstName?: string;
    lastName?: string;

    constructor(
        public username: string & Unique & MinLength<2> & MaxLength<16>,
        public email: string & Unique,
    ) {}
}

const database = new Database(new SQLiteDatabaseAdapter(':memory:'), [User]);
await database.migrate();

await database.persist(new User('Peter'));

const allUsers = await database.query(User).find();
console.log('all users', allUsers);
```

## 인터페이스

```typescript
import { PrimaryKey, AutoIncrement, Unique, MinLength, MaxLength } from '@deepkit/type';

interface User {
    id: number & PrimaryKey & AutoIncrement = 0;
    created: Date = new Date;
    firstName?: string;
    lastName?: string;
    username: string & Unique & MinLength<2> & MaxLength<16>;
}

const database = new Database(new SQLiteDatabaseAdapter(':memory:'));
database.register<User>({name: 'user'});

await database.migrate();

const user: User = {id: 0, created: new Date, username: 'Peter'};
await database.persist(user);

const allUsers = await database.query<User>().find();
console.log('all users', allUsers);
```

## 원시 타입

String, Number (bigint), Boolean 같은 원시 데이터 타입은 일반적인 데이터베이스 타입으로 매핑됩니다. TypeScript 타입만 사용됩니다.

```typescript

interface User {
    logins: number;
    username: string;
    pro: boolean;
}
```

## 기본 키

각 엔터티에는 정확히 하나의 기본 키가 필요합니다. 다중 기본 키는 지원되지 않습니다.

기본 키의 기본 타입은 임의일 수 있습니다. 보통 number 또는 UUID가 사용됩니다.
MongoDB에서는 종종 MongoId 또는 ObjectID가 사용됩니다.

number의 경우 `AutoIncrement`를 사용할 수 있습니다.

```typescript
import { PrimaryKey } from '@deepkit/type';

interface User {
    id: number & PrimaryKey;
}
```

## 자동 증가

삽입 시 자동으로 증가되어야 하는 필드는 `AutoIncrement` 데코레이터로 애너테이션합니다. 모든 어댑터가 auto-increment 값을 지원합니다. MongoDB 어댑터는 카운터를 추적하기 위해 추가 컬렉션을 사용합니다.

auto-increment 필드는 자동 카운터이며 기본 키에만 적용할 수 있습니다. 데이터베이스는 ID가 한 번만 사용되도록 자동으로 보장합니다.

```typescript
import { PrimaryKey, AutoIncrement } from '@deepkit/type';

interface User {
    id: number & PrimaryKey & AutoIncrement;
}
```

## UUID

UUID(v4) 타입이어야 하는 필드는 UUID 데코레이터로 애너테이션합니다. 런타임 타입은 `string`이며, 데이터베이스에서는 대부분 바이너리입니다. 새로운 UUID v4를 생성하려면 `uuid()` 함수를 사용하세요.

```typescript
import { uuid, UUID, PrimaryKey } from '@deepkit/type';

class User {
    id: UUID & PrimaryKey = uuid();
}
```

## MongoDB ObjectID

MongoDB에서 ObjectID 타입이어야 하는 필드는 `MongoId` 데코레이터로 애너테이션합니다. 런타임 타입은 `string`이고, 데이터베이스에서는 `ObjectId`(바이너리)입니다.

MongoID 필드는 삽입 시 자동으로 새로운 값을 받습니다. 필드 이름으로 반드시 `_id`를 사용할 필요는 없습니다. 아무 이름이나 사용할 수 있습니다.

```typescript
import { PrimaryKey, MongoId } from '@deepkit/type';

class User {
    id: MongoId & PrimaryKey = '';
}
```

## 옵셔널 / Nullable

옵셔널 필드는 TypeScript 타입으로 `title?: string` 또는 `title: string | null`로 선언합니다. 보통 `undefined`와 함께 동작하는 옵셔널 `?` 문법을 한 가지만 사용하는 것이 좋습니다.
두 가지 방식 모두 모든 SQL 어댑터에서 데이터베이스 타입이 `NULLABLE`이 됩니다. 따라서 이들 사이의 유일한 차이는 런타임에서 서로 다른 값을 표현한다는 점입니다.

다음 예시에서 modified 필드는 옵셔널이므로 런타임에서는 undefined가 될 수 있지만, 데이터베이스에서는 항상 NULL로 표현됩니다.

```typescript
import { PrimaryKey } from '@deepkit/type';

class User {
    id: number & PrimaryKey = 0;
    modified?: Date;
}
```

이 예시는 nullable 타입이 어떻게 동작하는지 보여줍니다. 데이터베이스와 JavaScript 런타임 모두에서 NULL이 사용됩니다. 이는 `modified?: Date`보다 장황하며 일반적으로는 잘 사용되지 않습니다.

```typescript
import { PrimaryKey } from '@deepkit/type';

class User {
    id: number & PrimaryKey = 0;
    modified: Date | null = null;
}
```

## 데이터베이스 타입 매핑

|===
|런타임 타입|SQLite|MySQL|Postgres|Mongo

|string|text|longtext|text|string
|number|float|double|double precision|int/number
|boolean|integer(1)|boolean|boolean|boolean
|date|text|datetime|timestamp|datetime
|array|text|json|jsonb|array
|map|text|json|jsonb|object
|map|text|json|jsonb|object
|union|text|json|jsonb|T
|uuid|blob|binary(16)|uuid|binary
|ArrayBuffer/Uint8Array/...|blob|longblob|bytea|binary
|===

`DatabaseField`를 사용하면 필드를 임의의 데이터베이스 타입으로 매핑할 수 있습니다. 타입은 마이그레이션 시스템에 변경 없이 전달되는 유효한 SQL 문이어야 합니다.

```typescript
import { DatabaseField } from '@deepkit/type';

interface User {
    title: string & DatabaseField<{type: 'VARCHAR(244)'}>;
}
```

특정 데이터베이스에 대해 필드를 매핑하려면 `SQLite`, `MySQL`, 또는 `Postgres`를 사용할 수 있습니다.

### SQLite

```typescript
import { SQLite } from '@deepkit/type';

interface User {
    title: string & SQLite<{type: 'text'}>;
}
```

### MySQL

```typescript
import { MySQL } from '@deepkit/type';

interface User {
    title: string & MySQL<{type: 'text'}>;
}
```

### Postgres

```typescript
import { Postgres } from '@deepkit/type';

interface User {
    title: string & Postgres<{type: 'text'}>;
}
```

## 임베디드 타입

## 기본값

## 기본 표현식

## 복합 타입

## 제외

## 데이터베이스별 컬럼 타입