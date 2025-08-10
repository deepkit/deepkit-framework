# エンティティ

エンティティは Class かオブジェクトリテラル（Interface）のいずれかであり、必ず主キーを持ちます。
エンティティには、`@deepkit/type` の型アノテーションを用いて必要な情報が付与されます。例えば、主キー、各フィールド、その検証制約などを定義します。これらのフィールドはデータベース構造（通常はテーブルまたはコレクション）を反映します。

`Mapped<'name'>` のような特別な型アノテーションにより、フィールド名をデータベース内の別名にマッピングすることもできます。

## Class

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

## Interface

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

## プリミティブ

String、Number（bigint）、Boolean のようなプリミティブデータ型は一般的なデータベース型にマッピングされます。TypeScript の型のみが使用されます。

```typescript

interface User {
    logins: number;
    username: string;
    pro: boolean;
}
```

## 主キー

各エンティティには主キーがちょうど1つ必要です。複数主キーはサポートされていません。

主キーの基底の型は任意で、一般的には number や UUID が使われます。
MongoDB では MongoId または ObjectID がよく使われます。

number の場合は `AutoIncrement` を使用できます。

```typescript
import { PrimaryKey } from '@deepkit/type';

interface User {
    id: number & PrimaryKey;
}
```

## オートインクリメント

挿入時に自動的にインクリメントされるべきフィールドには `AutoIncrement` デコレータを付与します。すべてのアダプタがオートインクリメント値をサポートします。MongoDB アダプタはカウンタを管理するために追加のコレクションを使用します。

オートインクリメントフィールドは自動カウンタであり、主キーにのみ適用できます。データベースは ID が一度しか使用されないことを自動的に保証します。

```typescript
import { PrimaryKey, AutoIncrement } from '@deepkit/type';

interface User {
    id: number & PrimaryKey & AutoIncrement;
}
```

## UUID

UUID（v4）型であるべきフィールドには UUID デコレータを付与します。実行時の型は `string` で、データベース内では多くの場合バイナリです。新しい UUID v4 を作成するには `uuid()` 関数を使用します。

```typescript
import { uuid, UUID, PrimaryKey } from '@deepkit/type';

class User {
    id: UUID & PrimaryKey = uuid();
}
```

## MongoDB ObjectID

MongoDB で ObjectID 型であるべきフィールドには `MongoId` デコレータを付与します。実行時の型は `string` で、データベース内では `ObjectId`（バイナリ）です。

MongoID フィールドは挿入時に自動的に新しい値が割り当てられます。フィールド名として `_id` を使用する必要はありません。任意の名前にできます。

```typescript
import { PrimaryKey, MongoId } from '@deepkit/type';

class User {
    id: MongoId & PrimaryKey = '';
}
```

## Optional / Nullable

Optional なフィールドは、TypeScript の型として `title?: string` または `title: string | null` のように宣言します。これらのうちどちらか一方のみを使用するべきで、通常は `undefined` とともに動作する Optional の `?` 構文を用います。
どちらの書き方でも、すべての SQL アダプタにおいてデータベース型は `NULLABLE` になります。したがって、この2つの記法の違いは、実行時に表す値が異なる点だけです。

次の例では、modified フィールドは Optional であるため実行時には undefined になり得ますが、データベースでは常に NULL として表現されます。

```typescript
import { PrimaryKey } from '@deepkit/type';

class User {
    id: number & PrimaryKey = 0;
    modified?: Date;
}
```

この例は nullable な型がどのように機能するかを示しています。データベースと JavaScript の実行時の両方で NULL が使用されます。これは `modified?: Date` よりも冗長であり、一般的には使用されません。

```typescript
import { PrimaryKey } from '@deepkit/type';

class User {
    id: number & PrimaryKey = 0;
    modified: Date | null = null;
}
```

## データベース型マッピング

|===
|実行時の型|SQLite|MySQL|Postgres|Mongo

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

`DatabaseField` を使用すると、フィールドを任意のデータベース型にマッピングできます。型は有効な SQL 文でなければならず、そのままマイグレーションシステムに渡されます。

```typescript
import { DatabaseField } from '@deepkit/type';

interface User {
    title: string & DatabaseField<{type: 'VARCHAR(244)'}>;
}
```

特定のデータベース向けにフィールドをマッピングするには、`SQLite`、`MySQL`、`Postgres` のいずれかを使用できます。

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

## 埋め込み型

## デフォルト値

## デフォルト式

## 複合型

## 除外

## データベース固有のカラム型