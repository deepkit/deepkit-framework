# はじめに

Deepkit はデータベースにモダンな方法でアクセスできる Database ORM を提供します。
エンティティは TypeScript の Type を使ってシンプルに定義できます:

```typescript
import { entity, PrimaryKey, AutoIncrement, 
    Unique, MinLength, MaxLength } from '@deepkit/type';

type Username = string & Unique & MinLength<2> & MaxLength<16>;

// クラスのエンティティ
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

// もしくは Interface で
interface User {
    id: number & PrimaryKey & AutoIncrement;
    created: Date;
    firstName?: string;
    lastName?: string;
    username: Username;
    email: string & Unique;
}
```

Deepkit のあらゆる TypeScript の Type と検証デコレーターを使って、エンティティを完全に定義できます。
エンティティの型システムは、これらの Type や Class を HTTP ルート、RPC アクション、フロントエンドなどの他の領域でも使用できるように設計されています。これにより、例えばアプリケーション全体のあちこちでユーザーを何度も定義してしまうといったことを防げます。

## インストール

Deepkit ORM は Runtime Types に基づいているため、`@deepkit/type` が正しくインストールされている必要があります。
[Runtime Type のインストール](../runtime-types/getting-started.md)を参照してください。

これが完了したら、`@deepkit/orm` 本体とデータベースアダプターをインストールできます。

Class をエンティティとして使用する場合は、tsconfig.json で `experimentalDecorators` を有効にする必要があります:

```json
{
  "compilerOptions": {
    "experimentalDecorators": true
  }
}
```

ライブラリをインストールしたら、データベースアダプターを導入し、その API を直接利用できます。

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

## 使い方

主に `Database` オブジェクトを使用します。インスタンス化すると、アプリケーション全体でデータのクエリや操作に利用できます。データベースへの接続は遅延初期化されます。

`Database` オブジェクトにはアダプターを渡します。これは各データベースアダプターのライブラリから提供されます。

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
    await database.migrate(); // テーブルを作成

    await database.persist(new User('Peter'));

    const allUsers = await database.query(User).find();
    console.log('all users', allUsers);
}

main();
```

### データベース

### 接続

#### リードレプリカ

## リポジトリ

## インデックス

## 大文字・小文字の区別

## 文字セット

## 照合順序

## バッチ処理

## キャッシュ

## マルチテナンシー

## 命名戦略

## ロック

### 楽観的ロック

### 悲観的ロック

## カスタム Type

## ロギング

## マイグレーション

## シーディング

## 生のデータベースアクセス

### SQL

### MongoDB

## プラグイン