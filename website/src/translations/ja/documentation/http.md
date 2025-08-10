# HTTP

HTTP リクエストの処理は、サーバーにとって最もよく知られたタスクの1つです。入力（HTTP リクエスト）を出力（HTTP レスポンス）に変換し、特定のタスクを実行します。クライアントは HTTP リクエストを介してさまざまな方法でサーバーにデータを送信でき、それらは正しく読み取り、適切に処理されなければなりません。HTTP ボディに加えて、HTTP クエリや HTTP ヘッダーの値も利用できます。データが実際にどのように処理されるかはサーバーに依存します。どこへ、どのように値をクライアントが送るかを定義するのはサーバーです。

ここで最優先されるのは、ユーザーが期待する処理を正しく実行することだけでなく、HTTP リクエストからのあらゆる入力を正しく変換（デシリアライズ）し、検証することです。

サーバー上で HTTP リクエストが通過するパイプラインは、多様で複雑になり得ます。多くのシンプルな HTTP ライブラリは、特定のルートに対して HTTP リクエストと HTTP レスポンスのみを渡し、開発者が HTTP レスポンスを直接処理することを想定しています。ミドルウェア API は、必要に応じてこのパイプラインを拡張できるようにします。

_Express の例_

```typescript
const http = express();
http.get('/user/:id', (request, response) => {
    response.send({id: request.params.id, username: 'Peter' );
});
```

これはシンプルなユースケースには非常に適していますが、アプリケーションが大きくなるにつれて、すべての入力と出力を手動でシリアライズ／デシリアライズし、検証しなければならないため、すぐに複雑になります。さらに、データベース抽象化のようなオブジェクトやサービスをアプリケーション自体からどのように取得するかも考慮する必要があります。これにより、これらの必須機能をマッピングするアーキテクチャを上に載せることを開発者に強いることになります。

これに対して、Deepkit の HTTP ライブラリは TypeScript と依存性注入の力を活用します。定義された型に基づいて、あらゆる値のシリアライズ／デシリアライズと検証が自動で行われます。また、上記の例のような関数型 API や、アーキテクチャのさまざまな要件に対応するためのコントローラークラスによってルートを定義することもできます。

これは、Node の `http` モジュールのような既存の HTTP サーバーでも、Deepkit フレームワークでも使用できます。どちらの API 形式も依存性注入コンテナにアクセスできるため、データベース抽象化や設定などのオブジェクトをアプリケーションから容易に取得できます。

## 関数型 API の例

```typescript
import { Positive } from '@deepkit/type';
import { http, HttpRouterRegistry } from '@deepkit/http';
import { FrameworkModule } from "@deepkit/framework";

//関数型API
const app = new App({
    imports: [new FrameworkModule()]
});
const router = app.get(HttpRouterRegistry);

router.get('/user/:id', (id: number & Positive, database: Database) => {
    //id は number かつ正の値であることが保証されています。
    //database は DI コンテナによって注入されます。
    return database.query(User).filter({ id }).findOne();
});

app.run();
```

## クラスコントローラー API

```typescript
import { Positive } from '@deepkit/type';
import { http, HttpRouterRegistry } from '@deepkit/http';
import { FrameworkModule } from "@deepkit/framework";
import { User } from "discord.js";

//コントローラーAPI
class UserController {
    constructor(private database: Database) {
    }

    @http.GET('/user/:id')
    user(id: number & Positive) {
        return this.database.query(User).filter({ id }).findOne();
    }
}

const app = new App({
    controllers: [UserController],
    imports: [new FrameworkModule()]
});
```