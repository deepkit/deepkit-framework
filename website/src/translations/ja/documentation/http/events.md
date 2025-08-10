# イベント

HTTP モジュールはワークフローエンジンに基づいており、HTTP リクエストの処理全体のプロセスにフックするために使用できる様々なイベントトークンを提供します。

ワークフローエンジンは有限状態機械であり、各 HTTP リクエストごとに新しい状態機械インスタンスを作成し、位置から位置へとジャンプします。最初の位置は `start`、最後は `response` です。各位置で追加のコードを実行できます。

![HTTP ワークフロー](/assets/documentation/framework/http-workflow.png)

各イベントトークンには、追加情報を含む独自のイベントタイプがあります。

| Event-Token                   | 説明                                                                                                                |
|-------------------------------|---------------------------------------------------------------------------------------------------------------------|
| httpWorkflow.onRequest        | 新しいリクエストが入ってきたとき                                                                                    |
| httpWorkflow.onRoute          | リクエストからルートを解決する必要があるとき                                                                         |
| httpWorkflow.onRouteNotFound  | ルートが見つからなかったとき                                                                                        |
| httpWorkflow.onAuth           | 認証が行われるとき                                                                                                  |
| httpWorkflow.onResolveParameters | ルートのパラメータが解決されるとき                                                                                  |
| httpWorkflow.onAccessDenied   | アクセスが拒否されたとき                                                                                            |
| httpWorkflow.onController     | コントローラーのアクションが呼び出されたとき                                                                         |
| httpWorkflow.onControllerError | コントローラーのアクションがエラーをスローしたとき                                                                  |
| httpWorkflow.onParametersFailed | ルートのパラメータの解決に失敗したとき                                                                              |
| httpWorkflow.onResponse       | コントローラーのアクションが呼び出されたとき。ここで結果をレスポンスへ変換します。                                  |

すべての HTTP イベントはワークフローエンジンに基づいているため、指定されたイベントを利用し、`event.next()` メソッドでそこへジャンプすることで、その挙動を変更できます。

HTTP モジュールは、これらのイベントトークンに対して独自のイベントリスナーを使用して HTTP リクエスト処理を実装しています。これらのイベントリスナーはすべて優先度が 100 に設定されており、あなたがイベントをリッスンするとデフォルトでは（デフォルトの優先度は 0 のため）あなたのリスナーが先に実行されます。HTTP のデフォルトハンドラーの後に実行したい場合は、優先度を 100 より大きく設定してください。

例えば、コントローラーが呼び出されたときのイベントを捕捉したいとします。特定のコントローラーが呼び出される場合、ユーザーがそれにアクセスできるかを確認します。ユーザーにアクセス権があればそのまま続行します。そうでなければ、次のワークフロー項目 `accessDenied` にジャンプします。そこでは、アクセス拒否の処理が自動的に継続されます。

```typescript
import { App } from '@deepkit/app';
import { FrameworkModule } from '@deepkit/framework';
import { HtmlResponse, http, httpAction, httpWorkflow } from '@deepkit/http';
import { eventDispatcher } from '@deepkit/event';

class MyWebsite {
    @http.GET('/')
    open() {
        return 'Welcome';
    }

    @http.GET('/admin').group('secret')
    secret() {
        return 'Welcome to the dark side';
    }
}

const app = new App({
    controllers: [MyWebsite],
    imports: [new FrameworkModule]
})

app.listen(httpWorkflow.onController, async (event) => {
    if (event.route.groups.includes('secret')) {
        //ここで Cookie セッション、JWT などの認証情報を確認します。

        //これは 'accessDenied' ワークフロー状態にジャンプし、
        //実質的にすべての onAccessDenied リスナーを実行します。

        //私たちのリスナーは HTTP カーネルのものより先に呼び出されるため、
        //標準のコントローラーアクションは決して呼び出されません。
        //これは内部的に event.next('accessDenied', ...) を呼び出します
        event.accessDenied();
    }
});

/**
 * 既定の accessDenied 実装を変更します。
 */
app.listen(httpWorkflow.onAccessDenied, async () => {
    if (event.sent) return;
    if (event.hasNext()) return;
    event.send(new HtmlResponse('No access to this area.', 403));
})

app.run();
```

```sh
$ curl http://localhost:8080/
Welcome
$ curl http://localhost:8080/admin
No access to this area
```