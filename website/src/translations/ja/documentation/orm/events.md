# イベント

イベントは Deepkit ORM にフックするための手段であり、強力なプラグインを作成できるようにします。イベントには2つのカテゴリがあります: Query イベントと Unit-of-Work イベントです。プラグインの作者は通常、両方の方法によるデータ操作をサポートするために両方を使用します。

イベントはイベントトークンに対して `Database.listen` を介して登録されます。短命なイベントリスナーはセッション上にも登録できます。

```typescript
import { Query, Database } from '@deepkit/orm';

const database = new Database(...);
database.listen(Query.onFetch, async (event) => {
});

const session = database.createSession();

//この特定のセッションに対してのみ実行されます
session.eventDispatcher.listen(Query.onFetch, async (event) => {
});
```

## Query イベント

Query イベントは、`Database.query()` または `Session.query()` を介してクエリが実行されたときに発火します。

各イベントには、エンティティの型、クエリ自体、データベースセッションなどの追加のプロパティがあります。`Event.query` に新しいクエリを設定することで、クエリを上書きできます。

```typescript
import { Query, Database } from '@deepkit/orm';

const database = new Database(...);

const unsubscribe = database.listen(Query.onFetch, async event => {
    //ユーザーのクエリを上書きし、別の処理が実行されるようにします。
    event.query = event.query.filterField('fieldName', 123);
});

//フックを削除するには unsubscribe を呼び出します
unsubscribe();
```

「Query」には複数のイベントトークンがあります:

| イベントトークン       | 説明                                                       |
|--------------------|-------------------------------------------------------------|
| Query.onFetch      | find()/findOne()/等でオブジェクトが取得されたとき            |
| Query.onDeletePre  | deleteMany/deleteOne() によってオブジェクトが削除される前    |
| Query.onDeletePost | deleteMany/deleteOne() によってオブジェクトが削除された後    |
| Query.onPatchPre   | patchMany/patchOne() によってオブジェクトがパッチ/更新される前 |
| Query.onPatchPost  | patchMany/patchOne() によってオブジェクトがパッチ/更新された後 |

## Unit Of Work イベント

Unit-of-Work イベントは、新しいセッションが変更を送信したときにトリガーされます。

| イベントトークン                 | 説明                                                                                                         |
|----------------------------------|--------------------------------------------------------------------------------------------------------------|
| DatabaseSession.onUpdatePre      | `DatabaseSession` オブジェクトがデータベースレコードに対する更新操作を開始する直前にトリガーされます。         |
| DatabaseSession.onUpdatePost     | `DatabaseSession` オブジェクトが更新操作を正常に完了した直後にトリガーされます。                             |
| DatabaseSession.onInsertPre      | `DatabaseSession` オブジェクトがデータベースへの新規レコードの挿入を開始する直前にトリガーされます。         |
| DatabaseSession.onInsertPost     | `DatabaseSession` オブジェクトが新規レコードの挿入に成功した直後にトリガーされます。                         |
| DatabaseSession.onDeletePre      | `DatabaseSession` オブジェクトがデータベースからレコードを削除する操作を開始する直前にトリガーされます。     |
| DatabaseSession.onDeletePost     | `DatabaseSession` オブジェクトが削除操作を完了した直後にトリガーされます。                                   |
| DatabaseSession.onCommitPre      | `DatabaseSession` オブジェクトがセッション中に行われた変更をデータベースにコミットする直前にトリガーされます。 |