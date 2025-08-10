# 상속

Deepkit ORM에서 상속을 구현하는 방법은 여러 가지가 있습니다.

## 클래스 상속

한 가지 방법은 `extends`를 사용하는 간단한 클래스들을 통한 클래스 상속을 이용하는 것입니다.

```typescript
import { PrimaryKey, AutoIncrement } from '@deepkit/type';

class BaseModel {
    id: number & PrimaryKey & AutoIncrement = 0;
    created: Date = new Date;
    updated: Date = new Date;
}

class User extends BaseModel {
    name: string = '';
}

class Customer extends BaseModel {
    name: string = '';
    address: string = '';
}

new Database(
    new SQLiteDatabaseAdapter('./example.sqlite'),
    [User, Customer]
);
```

`BaseModel`은 엔티티로 사용되지 않으므로 데이터베이스에 등록되지 않습니다. `User`와 `Customer`만 엔티티로 등록되며, `BaseModel`의 모든 프로퍼티가 포함된 테이블에 매핑됩니다.

SQL 테이블은 다음과 같습니다:

```sql
CREATE TABLE user (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    created TEXT NOT NULL,
    updated TEXT NOT NULL,
    name TEXT NOT NULL
);

CREATE TABLE customer (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    created TEXT NOT NULL,
    updated TEXT NOT NULL,
    name TEXT NOT NULL,
    address TEXT NOT NULL
);
```

## 단일 테이블 상속

단일 테이블 상속(Single Table Inheritance)은 여러 엔티티를 하나의 테이블에 저장하는 방식입니다. 각 모델마다 별도의 테이블을 두는 대신 단일 테이블을 사용하고, 각 레코드의 타입을 판별하기 위해 추가 컬럼(보통 type과 같은 이름)을 사용합니다. 동일한 프로퍼티를 공유하는 엔티티가 많을 때 유용합니다.

```typescript
import { PrimaryKey, AutoIncrement, entity } from '@deepkit/type';

@entity.collection('persons')
abstract class Person {
    id: number & PrimaryKey & AutoIncrement = 0;
    firstName?: string;
    lastName?: string;
    abstract type: string;
}

@entity.singleTableInheritance()
class Employee extends Person {
    email?: string;

    type: 'employee' = 'employee';
}

@entity.singleTableInheritance()
class Freelancer extends Person {
    @t budget: number = 10_000;

    type: 'freelancer' = 'freelancer';
}

new Database(
    new SQLiteDatabaseAdapter('./example.sqlite'), 
    [Employee, Freelancer]
);
```

`Person` 클래스는 엔티티가 아니므로 데이터베이스에 등록되지 않습니다. `Employee`와 `Freelancer` 클래스는 엔티티이며 `persons`라는 이름의 단일 테이블에 매핑됩니다. `type` 컬럼은 각 레코드의 타입을 판별하는 데 사용됩니다.

SQL 테이블은 다음과 같습니다:

```sql
CREATE TABLE persons (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    firstName TEXT,
    lastName TEXT,
    type TEXT NOT NULL,
    email TEXT,
    budget INTEGER
);
``` 

보시다시피 budget은 선택적(optional)로 처리됩니다(비록 `Freelance` 클래스에서는 필수이지만). 이는 budget 값이 없는 `Employee`를 동일한 테이블에 저장할 수 있도록 하기 위함입니다. 이는 단일 테이블 상속의 한계입니다.