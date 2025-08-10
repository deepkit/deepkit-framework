# クエリ

クエリは、データベースからデータを取得または変更する方法を記述するオブジェクトです。クエリを記述するための複数の Method と、それらを実行する終端 Method を持ちます。データベースアダプターは、データベース固有の機能をサポートするために、クエリ API をさまざまな方法で拡張できます。

`Database.query(T)` または `Session.query(T)` を使用してクエリを作成できます。パフォーマンスが向上するため、Session の使用を推奨します。

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

## フィルター

フィルターを適用して結果セットを絞り込むことができます。

```typescript
//シンプルなフィルター
const users = await database.query(User).filter({name: 'User1'}).find();

//複数フィルター。すべて AND
const users = await database.query(User).filter({name: 'User1', id: 2}).find();

//範囲フィルター: $gt, $lt, $gte, $lte（より大きい、より小さい、...）
//WHERE created < NOW() と同等
const users = await database.query(User).filter({created: {$lt: new Date}}).find();
//WHERE id > 500 と同等
const users = await database.query(User).filter({id: {$gt: 500}}).find();
//WHERE id >= 500 と同等
const users = await database.query(User).filter({id: {$gte: 500}}).find();

//集合フィルター: $in, $nin（IN, NOT IN）
//WHERE id IN (1, 2, 3) と同等
const users = await database.query(User).filter({id: {$in: [1, 2, 3]}}).find();

//正規表現フィルター
const users = await database.query(User).filter({username: {$regex: /User[0-9]+/}}).find();

//グルーピング: $and, $nor, $or
//WHERE (username = 'User1') OR (username = 'User2') と同等
const users = await database.query(User).filter({
    $or: [{username: 'User1'}, {username: 'User2'}]
}).find();


//ネストされたグルーピング
//WHERE username = 'User1' OR (username = 'User2' and id > 0) と同等
const users = await database.query(User).filter({
    $or: [{username: 'User1'}, {username: 'User2', id: {$gt: 0}}]
}).find();


//ネストされたグルーピング
//WHERE username = 'User1' AND (created < NOW() OR id > 0) と同等
const users = await database.query(User).filter({
    $and: [{username: 'User1'}, {$or: [{created: {$lt: new Date}, id: {$gt: 0}}]}]
}).find();
```

### 等価

### 大なり/小なり

### 正規表現

### グルーピング AND/OR

### IN

## Select

データベースから受け取るフィールドを絞り込むには、`select('field1')` を使用します。

```typescript
const user = await database.query(User).select('username').findOne();
const user = await database.query(User).select('id', 'username').findOne();
```

`select` を使ってフィールドを絞り込んだ時点で、結果はエンティティのインスタンスではなく、オブジェクトリテラルのみになることに注意してください。

```
const user = await database.query(User).select('username').findOne();
user instanceof User; //false
```

## 並び順

`orderBy(field, order)` でエントリの並び順を変更できます。
`orderBy` は複数回実行でき、順序を段階的に詳細化できます。

```typescript
const users = await session.query(User).orderBy('created', 'desc').find();
const users = await session.query(User).orderBy('created', 'asc').find();
```

## ページネーション

`itemsPerPage()` と `page()` を使って、結果をページングできます。ページは 1 から開始します。

```typescript
const users = await session.query(User).itemsPerPage(50).page(1).find();
```

代替の `limit` と `skip` を使えば手動でページングできます。

```typescript
const users = await session.query(User).limit(5).skip(10).find();
```

[#database-join]
## 結合

デフォルトでは、エンティティからの参照はクエリに含まれず、ロードもされません。参照をロードせずにクエリに結合を含めるには、`join()`（LEFT JOIN）または `innerJoin()` を使用します。参照をロードしつつクエリに結合を含めるには、`joinWith()` または `innerJoinWith()` を使用します。

以下の例はすべて、次のモデルスキーマを前提としています。

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
//グループが割り当てられたユーザーのみを選択（INNER JOIN）
const users = await session.query(User).innerJoin('group').find();
for (const user of users) {
    user.group; //参照がロードされていないため error
}
```

```typescript
//グループが割り当てられたユーザーのみを選択（INNER JOIN）し、リレーションをロード
const users = await session.query(User).innerJoinWith('group').find();
for (const user of users) {
    user.group.name; //動作します
}
```

結合クエリを修正するには、同じ Method を `use` プレフィックス付きで使用します: `useJoin`, `useInnerJoin`, `useJoinWith`, `useInnerJoinWith`。結合クエリの修正を終了し、親クエリに戻るには `end()` を使用します。

```typescript
//名前が 'admins' のグループが割り当てられているユーザーのみを選択（INNER JOIN）
const users = await session.query(User)
    .useInnerJoinWith('group')
        .filter({name: 'admins'})
        .end()  // 親クエリに戻る
    .find();

for (const user of users) {
    user.group.name; //常に admin
}
```

## 集計

集計 Method により、レコードのカウントやフィールドの集計が可能です。

次の例は、このモデルスキーマを前提としています。

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

`groupBy` は指定したフィールドで結果をグルーピングします。

```typescript
await database.persist(
    cast<File>({path: 'file1', category: 'images'}),
    cast<File>({path: 'file2', category: 'images'}),
    cast<File>({path: 'file3', category: 'pdfs'})
);

//[ { category: 'images' }, { category: 'pdfs' } ]
await session.query(File).groupBy('category').find();
```

利用できる集計 Method は複数あります: `withSum`, `withAverage`, `withCount`, `withMin`, `withMax`, `withGroupConcat`。いずれも第1引数にフィールド名を取り、別名を変更するための任意の第2引数を取ります。

```typescript
// まず、いくつかのレコードを更新します:
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

`patch` および `delete` による変更時に、`returning` で追加のフィールドを要求できます。

注意: すべてのデータベースアダプターがフィールドをアトミックに返すわけではありません。データ整合性を確保するためにトランザクションを使用してください。

```typescript
await database.query(User).patchMany({visits: 0});

//{ modified: 1, returning: { visits: [ 5 ] }, primaryKeys: [ 1 ] }
const result = await database.query(User)
    .filter({username: 'User1'})
    .returning('username', 'visits')
    .patchOne({$inc: {visits: 5}});
```

## Find

指定したフィルターに一致するエントリの配列を返します。

```typescript
const users: User[] = await database.query(User).filter({username: 'Peter'}).find();
```

## FindOne

指定したフィルターに一致するアイテムを返します。
アイテムが見つからない場合、`ItemNotFound` Error がスローされます。

```typescript
const users: User = await database.query(User).filter({username: 'Peter'}).findOne();
```

## FindOneOrUndefined

指定したフィルターに一致するエントリを返します。
エントリが見つからない場合は、undefined が返されます。

```typescript
const query = database.query(User).filter({username: 'Peter'});
const users: User|undefined = await query.findOneOrUndefined();
```

## FindField

指定したフィルターに一致するフィールドのリストを返します。

```typescript
const usernames: string[] = await database.query(User).findField('username');
```

## FindOneField

指定したフィルターに一致するフィールドのリストを返します。
エントリが見つからない場合、`ItemNotFound` Error がスローされます。

```typescript
const username: string = await database.query(User).filter({id: 3}).findOneField('username');
```

## Patch

Patch は、クエリで記述されたレコードをパッチする変更クエリです。`patchOne` と `patchMany` の Method がクエリを終了し、パッチを実行します。

`patchMany` は、指定したフィルターに一致するすべてのレコードをデータベースで変更します。フィルターが設定されていない場合は、テーブル全体が変更されます。1件のみ変更するには `patchOne` を使用します。

```typescript
await database.query(User).filter({username: 'Peter'}).patch({username: 'Peter2'});

await database.query(User).filter({username: 'User1'}).patchOne({birthdate: new Date});
await database.query(User).filter({username: 'User1'}).patchOne({$inc: {visits: 1}});

await database.query(User).patchMany({visits: 0});
```

## Delete

`deleteMany` は、指定したフィルターに一致するすべてのエントリをデータベースから削除します。
フィルターが設定されていない場合は、テーブル全体が削除されます。1件のみ削除するには `deleteOne` を使用します。

```typescript
const result = await database.query(User)
    .filter({visits: 0})
    .deleteMany();

const result = await database.query(User).filter({id: 4}).deleteOne();
```

## Has

データベースに少なくとも1件のエントリが存在するかどうかを返します。

```typescript
const userExists: boolean = await database.query(User).filter({username: 'Peter'}).has();
```

## Count

エントリ数を返します。

```typescript
const userCount: number = await database.query(User).count();
```

## Lift

クエリのリフトとは、クエリに新しい機能を追加することを意味します。これは通常、プラグインや複雑なアーキテクチャで、大きなクエリ Class を複数の使いやすく再利用可能な Class に分割するために使用されます。

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