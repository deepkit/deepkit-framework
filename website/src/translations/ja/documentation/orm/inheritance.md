# 継承

Deepkit ORM で継承を実装する方法はいくつかあります。

## クラス継承

その一つはクラス継承を用いる方法で、`extends` を使ったシンプルなクラスを利用します。

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

`BaseModel` はエンティティとして使用されないため、データベースには登録されません。`User` と `Customer` のみがエンティティとして登録され、`BaseModel` のすべてのプロパティを含めてテーブルにマッピングされます。

SQL テーブルは次のようになります:

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

## 単一テーブル継承

単一テーブル継承は、複数のエンティティを1つのテーブルに格納する方法です。各モデルごとに別々のテーブルを持つ代わりに、単一のテーブルを使用し、各レコードの種類を判別するために追加の列（しばしば type などと名付けられます）を利用します。これは、同じプロパティを共有するエンティティが多い場合に有用です。

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

`Person` クラスはエンティティではないため、データベースには登録されません。`Employee` と `Freelancer` クラスはエンティティであり、`persons` という名前の単一のテーブルにマッピングされます。`type` 列は各レコードの種類を判定するために使用されます。

SQL テーブルは次のようになります:

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

ご覧のとおり、budget は任意項目になっています（`Freelance` クラスでは必須であるにもかかわらず）。これは、同じテーブルに `Employee`（budget の値を持たない）を挿入できるようにするためです。これは単一テーブル継承の制約です。