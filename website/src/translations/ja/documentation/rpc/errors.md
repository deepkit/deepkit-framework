# エラー

throw された Error は、エラーメッセージやスタックトレースなどの情報とともに自動的にクライアントへ転送されます。

Error オブジェクトの nominal なインスタンスが重要（`instanceof` を使用するため）な場合は、指定の Error Class が runtime に登録され再利用されるように、`@entity.name('@error:unique-name')` を使用する必要があります。

```typescript
@entity.name('@error:myError')
class MyError extends Error {}

// サーバー
@rpc.controller('/main')
class Controller {
    @rpc.action()
    saveUser(user: User): void {
        throw new MyError('Can not save user');
    }
}

// クライアント
// [MyError] により、Class MyError が runtime で認識されることを保証します
const controller = client.controller<Controller>('/main', [MyError]);

try {
    await controller.getUser(2);
} catch (e) {
    if (e instanceof MyError) {
        // おっと、ユーザーを保存できませんでした
    } else {
        // その他すべてのエラー
    }
}
```

## Error の変換

throw された Error はエラーメッセージやスタックトレースなどの情報とともに自動的にクライアントへ転送されるため、意図せず機密情報を公開してしまう可能性があります。これを変更するには、Method `transformError` で throw された Error を修正できます。

```typescript
class MyKernelSecurity extends RpcKernelSecurity {
    constructor(private logger: Logger) {
        super();
    }

    transformError(error: Error) {
        // 新しい Error でラップする
        this.logger.error('Error in RPC', error);
        return new Error('Something went wrong: ' + error.message);
    }
}
```

一度エラーが汎用的な `error` に変換されると、完全なスタックトレースと Error の同一性は失われます。したがって、クライアント側のエラーに対して `instanceof` チェックは使用できません。

Deepkit RPC が 2 つのマイクロサービス間で使用され、クライアントとサーバーが開発者の完全な管理下にある場合、Error の変換が必要になることは稀です。一方、クライアントが不特定のユーザーのブラウザ上で動作している場合には、`transformError` においてどの情報を公開するかに注意する必要があります。迷う場合は、内部の詳細が漏洩しないように、各 Error を汎用的な `Error` に変換すべきです。その際、Error をログに記録するのがよいでしょう。