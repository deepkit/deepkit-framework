# セッション / ユニット・オブ・ワーク

セッションはユニット・オブ・ワークのようなものです。あなたが行うすべてを追跡し、`commit()` が呼び出されるたびに変更を自動的に記録します。ステートメントを束ねて非常に高速にするため、データベースの変更を実行する推奨の方法です。セッションは非常に軽量で、たとえばリクエスト/レスポンスのライフサイクル内で簡単に作成できます。

```typescript
import { SQLiteDatabaseAdapter } from '@deepkit/sqlite';
import { entity, PrimaryKey, AutoIncrement } from '@deepkit/type';
import { Database } from '@deepkit/orm';

async function main() {

    @entity.name('user')
    class User {
        id: number & PrimaryKey & AutoIncrement = 0;
        created: Date = new Date;

        constructor(public name: string) {
        }
    }

    const database = new Database(new SQLiteDatabaseAdapter(':memory:'), [User]);
    await database.migrate();

    const session = database.createSession();
    session.add(new User('User1'), new User('User2'), new User('User3'));

    await session.commit();

    const users = await session.query(User).find();
    console.log(users);
}

main();
```

`session.add(T)` で新しいインスタンスをセッションに追加し、`session.remove(T)` で既存のインスタンスを削除します。Session オブジェクトの使用が終わったら、ガーベジコレクタが回収できるように、すべての場所で単に参照を解除してください。

Session オブジェクト経由で取得したエンティティインスタンスの変更は自動的に検出されます。

```typescript
const users = await session.query(User).find();
for (const user of users) {
    user.name += ' changed';
}

await session.commit();//すべてのユーザーを保存
```

## アイデンティティマップ

セッションはアイデンティティマップを提供し、各データベースエントリにつき常に 1 つの JavaScript オブジェクトだけが存在することを保証します。例えば、同一のセッション内で `session.query(User).find()` を 2 回実行すると、2 つの異なる配列が得られますが、その中に入っているエンティティインスタンスは同一です。

`session.add(entity1)` で新しいエンティティを追加し、それを再取得すると、まったく同じエンティティインスタンス `entity1` が返されます。

重要: セッションを使い始めたら、`database.query` の代わりに `session.query` メソッドを使用すべきです。アイデンティティマッピング機能が有効なのはセッションのクエリだけです。

## 変更検出

## リクエスト/レスポンス