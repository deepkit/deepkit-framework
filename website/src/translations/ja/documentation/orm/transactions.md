# トランザクション

トランザクションは、select、insert、update、delete といったステートメント、クエリ、または操作の連続したグループで、1 つの作業単位として実行され、コミットまたはロールバックが可能です。

Deepkit は、公式にサポートされているすべてのデータベースでトランザクションをサポートします。既定では、いかなるクエリやデータベースセッションにもトランザクションは使用されません。トランザクションを有効にするには、主に 2 つの方法（セッションとコールバック）があります。

## セッション・トランザクション

作成する各セッションに対して新しいトランザクションを開始して割り当てることができます。これはデータベースとやり取りする推奨の方法で、Session オブジェクトを簡単に渡すことができ、このセッションによって生成されたすべてのクエリは自動的にそのトランザクションに割り当てられます。

一般的なパターンとしては、すべての操作を try-catch ブロックで囲み、最後の行で `commit()` を実行します（これはそれ以前のすべてのコマンドが成功した場合にのみ実行されます）。エラーが発生したら catch ブロックで `rollback()` を実行し、すべての変更をすぐに巻き戻します。

代替の API（下記参照）はありますが、すべてのトランザクションはデータベースセッションオブジェクトでのみ機能します。データベースセッションのユニット・オブ・ワークの未反映変更をデータベースにコミットするには、通常 `commit()` を呼び出します。トランザクション・セッションでは、`commit()` は保留中の変更をデータベースにコミットするだけでなく、トランザクション自体も完了（「コミット」）して閉じます。代わりに `session.flush()` を呼び出して、`commit` せずに（つまりトランザクションを閉じずに）保留中の変更をすべてコミットすることもできます。ユニット・オブ・ワークをフラッシュせずにトランザクションのみをコミットするには、`session.commitTransaction()` を使用します。

```typescript
const session = database.createSession();

//これにより新しいトランザクションが割り当てられ、次のデータベース操作のタイミングで開始されます。
session.useTransaction();

try {
    //このクエリはトランザクション内で実行されます
    const users = await session.query(User).find();

    await moreDatabaseOperations(session);

    await session.commit();
} catch (error) {
    await session.rollback();
}
```

セッションで `commit()` または `rollback()` が実行されると、トランザクションは解放されます。新しいトランザクションで続行したい場合は、再度 `useTransaction()` を呼び出す必要があります。

注意点として、トランザクション・セッションで最初のデータベース操作が実行されると、割り当てられたデータベース接続は現在のセッションオブジェクトに固定され、専有（スティッキー）されます。そのため、その後のすべての操作は同じ接続（つまり多くのデータベースでは同じデータベースサーバー）上で実行されます。トランザクション・セッションが終了（commit または rollback）したときにのみ、データベース接続は再び解放されます。したがって、トランザクションは必要最小限の期間にとどめることを推奨します。

セッションがすでにトランザクションに接続されている場合、`session.useTransaction()` の呼び出しは常に同じオブジェクトを返します。セッションにトランザクションが関連付けられているかどうかは、`session.isTransaction()` で確認できます。

入れ子のトランザクションはサポートされません。

## トランザクション・コールバック

トランザクション・セッションの代替として、`database.transaction(callback)` があります。

```typescript
await database.transaction(async (session) => {
    //このクエリはトランザクション内で実行されます
    const users = await session.query(User).find();

    await moreDatabaseOperations(session);
});
```

`database.transaction(callback)` メソッドは、新しいトランザクション・セッション内で非同期コールバックを実行します。コールバックが成功した場合（つまり、エラーがスローされない場合）、セッションは自動的にコミットされます（その結果、トランザクションがコミットされ、すべての変更がフラッシュされます）。コールバックが失敗した場合、セッションは自動的に `rollback()` を実行し、エラーは伝播されます。

## 分離レベル

多くのデータベースは異なる種類のトランザクションをサポートしています。トランザクションの動作を変更するには、`useTransaction()` から返されるトランザクションオブジェクトに対してさまざまなメソッドを呼び出します。このトランザクションオブジェクトのインターフェイスは、使用しているデータベースアダプタによって異なります。たとえば、MySQL データベースから返されるトランザクションオブジェクトは、MongoDB データベースのものとは異なるオプションを持ちます。可能なオプションの一覧を取得するには、コード補完を利用するか、データベースアダプタのインターフェイスを参照してください。

```typescript
const database = new Database(new MySQLDatabaseAdapter());

const session = database.createSession();
session.useTransaction().readUncommitted();

try {
    //...操作
    await session.commit();
} catch (error) {
    await session.rollback();
}

//または
await database.transaction(async (session) => {
    //これは、いかなるデータベース操作も実行されていない限り有効です。
    session.useTransaction().readUncommitted();

    //...操作
});
```

MySQL、PostgreSQL、SQLite ではデフォルトでトランザクションが機能しますが、MongoDB ではまず「レプリカセット」としてセットアップする必要があります。

標準の MongoDB インスタンスをレプリカセットに変換するには、公式ドキュメントを参照してください:
[スタンドアロンをレプリカセットに変換する](https://docs.mongodb.com/manual/tutorial/convert-standalone-to-replica-set)。