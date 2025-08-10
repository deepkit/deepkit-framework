# サービス


サービスは、アプリケーションに必要なあらゆる値、関数、または機能を包含する広いカテゴリです。サービスは通常、目的が狭く明確に定義されたクラスです。特定のことを行い、それをうまく実行すべきです。

Deepkit（およびほとんどの他の JavaScript/TypeScript フレームワーク）におけるサービスは、プロバイダを使ってモジュールに登録されるシンプルなクラスです。最も単純なプロバイダはクラスプロバイダで、クラス自体以外は何も指定しません。これにより、そのサービスは定義されたモジュールの依存性注入コンテナ内でシングルトンになります。

サービスは依存性注入コンテナによって管理・インスタンス化されるため、コンストラクタインジェクションまたはプロパティインジェクションを用いて、他のサービス、コントローラ、イベントリスナーでインポートして利用できます。詳細は[依存性注入](../dependency-injection)の章を参照してください。

単純なサービスを作成するには、目的を持ったクラスを作成します:


```typescript
export interface User {
    username: string;
}

export class UserManager {
    users: User[] = [];

    addUser(user: User) {
        this.users.push(user);
    }
}
```

そして、それをアプリケーションまたはモジュールに登録します:

```typescript
new App({
    providers: [UserManager]
}).run();
```

これを行うと、このサービスをコントローラ、他のサービス、またはイベントリスナーで使用できます。たとえば、このサービスを CLI コマンドや HTTP ルートで使用してみましょう:


```typescript
import { App } from '@deepkit/app';
import { HttpRouterRegistry } from '@deepkit/http';

const app = new App({
    providers: [UserManager],
    imports: [new FrameworkModule({debug: true})]
});

app.command('test', (userManager: UserManager) => {
    for (const user of userManager.users) {
        console.log('User: ', user.username);
    }
});

const router = app.get(HttpRouterRegistry);

router.get('/', (userManager: UserManager) => {
    return userManager.users;
})

app.run();
```

サービスは Deepkit における基本的な構成要素であり、クラスに限定されません。実際、サービスはアプリケーションに必要な任意の値、関数、または機能であり得ます。詳しくは、[依存性注入](../dependency-injection)の章を参照してください。