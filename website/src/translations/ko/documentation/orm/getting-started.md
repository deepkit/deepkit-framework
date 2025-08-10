# 시작하기

Deepkit은 데이터베이스에 현대적인 방식으로 접근할 수 있게 해주는 Database ORM을 제공합니다.
엔티티는 TypeScript 타입을 사용하여 간단히 정의됩니다:

```typescript
import { entity, PrimaryKey, AutoIncrement, 
    Unique, MinLength, MaxLength } from '@deepkit/type';

type Username = string & Unique & MinLength<2> & MaxLength<16>;

// 클래스 엔티티
@entity.name('user')
class User {
    id: number & PrimaryKey & AutoIncrement = 0;
    created: Date = new Date;
    firstName?: string;
    lastName?: string;

    constructor(
        public username: Username,
        public email: string & Unique,
    ) {}
}

// 또는 interface로
interface User {
    id: number & PrimaryKey & AutoIncrement;
    created: Date;
    firstName?: string;
    lastName?: string;
    username: Username;
    email: string & Unique;
}
```

Deepkit의 모든 TypeScript 타입과 검증 Decorator를 사용해 엔티티를 완전히 정의할 수 있습니다.
엔티티 타입 시스템은 이러한 타입이나 클래스가 HTTP routes, RPC actions, 또는 frontend와 같은 다른 영역에서도 사용할 수 있도록 설계되었습니다. 이는 예를 들어 애플리케이션 전체에 동일한 사용자를 여러 번 분산 정의하는 일을 방지합니다.

## 설치

Deepkit ORM은 Runtime Types에 기반하므로, `@deepkit/type`이 올바르게 설치되어 있어야 합니다.
[Runtime Type 설치](../runtime-types/getting-started.md)를 참조하세요.

이 작업이 완료되면, `@deepkit/orm` 자체와 데이터베이스 어댑터를 설치할 수 있습니다.

클래스를 엔티티로 사용하려면 tsconfig.json에서 `experimentalDecorators`를 활성화해야 합니다:

```json
{
  "compilerOptions": {
    "experimentalDecorators": true
  }
}
```

라이브러리가 설치되면, 데이터베이스 어댑터를 설치하고 해당 API를 바로 사용할 수 있습니다.

### SQLite

```sh
npm install @deepkit/orm @deepkit/sqlite
```

```typescript
import { SQLiteDatabaseAdapter } from '@deepkit/sqlite';

const database = new Database(new SQLiteDatabaseAdapter('./example.sqlite'), [User]);
const database = new Database(new SQLiteDatabaseAdapter(':memory:'), [User]);
```

### MySQL

```sh
npm install @deepkit/orm @deepkit/mysql
```

```typescript
import { MySQLDatabaseAdapter } from '@deepkit/mysql';

const database = new Database(new MySQLDatabaseAdapter({
    host: 'localhost',
    port: 3306
}), [User]);
```

### Postgres

```sh
npm install @deepkit/orm @deepkit/postgres
```

```typescript
import { PostgresDatabaseAdapter } from '@deepkit/postgres';

const database = new Database(new PostgresDatabaseAdapter({
    host: 'localhost',
    port: 3306
}), [User]);
```

### MongoDB

```sh
npm install @deepkit/orm @deepkit/bson @deepkit/mongo
```

```typescript
import { MongoDatabaseAdapter } from '@deepkit/mongo';

const database = new Database(new MongoDatabaseAdapter('mongodb://localhost/mydatabase'), [User]);
```

## 사용법

주로 `Database` 객체를 사용합니다. 한 번 인스턴스화되면 애플리케이션 전반에서 데이터를 조회하거나 조작하는 데 사용할 수 있습니다. 데이터베이스 연결은 지연 초기화(lazy)됩니다.

`Database` 객체에는 데이터베이스 어댑터 라이브러리에서 제공되는 어댑터를 전달합니다.

```typescript
import { SQLiteDatabaseAdapter } from '@deepkit/sqlite';
import { entity, PrimaryKey, AutoIncrement } from '@deepkit/type';
import { Database } from '@deepkit/orm';

async function main() {
    @entity.name('user')
    class User {
        public id: number & PrimaryKey & AutoIncrement = 0;
        created: Date = new Date;

        constructor(public name: string) {
        }
    }

    const database = new Database(new SQLiteDatabaseAdapter('./example.sqlite'), [User]);
    await database.migrate(); // 테이블 생성

    await database.persist(new User('Peter'));

    const allUsers = await database.query(User).find();
    console.log('all users', allUsers);
}

main();
```

### 데이터베이스

### 연결

#### 읽기 복제본

## 리포지토리

## 인덱스

## 대소문자 구분

## 문자 집합

## 정렬 규칙

## 배치 처리

## 캐싱

## 멀티테넌시

## 네이밍 전략

## 잠금

### 낙관적 잠금

### 비관적 잠금

## 커스텀 타입

## 로깅

## 마이그레이션

## 시딩

## 원시 데이터베이스 액세스

### SQL

### MongoDB

## 플러그인