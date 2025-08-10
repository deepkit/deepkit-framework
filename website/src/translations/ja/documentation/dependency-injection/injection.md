# インジェクション

依存関係が注入されるため、Dependency Injection と呼ばれます。インジェクションは、ユーザー（手動）または DI コンテナ（自動）によって行われます。

## コンストラクタ インジェクション

ほとんどの場合、コンストラクタ インジェクションが使われます。すべての依存関係はコンストラクタの引数として指定され、DI コンテナによって自動的に注入されます。

```typescript
class MyService {
    constructor(protected database: Database) {
    }
}
```

オプションの依存関係はそのように明示する必要があります。そうしないと、プロバイダが見つからない場合に Error が発生する可能性があります。

```typescript
class MyService {
    constructor(protected database?: Database) {
    }
}
```

## プロパティ インジェクション

コンストラクタ インジェクションの代替として、プロパティ インジェクションがあります。これは通常、依存関係がオプションである場合や、コンストラクタがそれ以上引数でいっぱいな場合に使用されます。インスタンスが生成され（つまりコンストラクタが実行され）ると、プロパティは自動的に代入されます。

```typescript
import { Inject } from '@deepkit/core';

class MyService {
    // 必須
    protected database!: Inject<Database>;

    // またはオプション
    protected database?: Inject<Database>;
}
```

## パラメータ インジェクション

さまざまな場所でコールバック関数を定義できます。例えば HTTP ルートや CLI コマンドです。この場合、依存関係をパラメータとして定義できます。DI コンテナによって自動的に注入されます。

```typescript
import { Database } from './db';

app.get('/', (database: Database) => {
    //...
});
```

## Injector コンテキスト

依存関係を動的に解決したい場合は、`InjectorContext` をインジェクトして、それを使って依存関係を取得できます。

```typescript
import { InjectorContext } from '@deepkit/injector';

class MyService {
    constructor(protected context: InjectorContext) {
    }

    getDatabase(): Database {
        return this.context.get(Database);
    }
}
```

これは [Dependency Injection のスコープ](./scopes.md) を扱う際に特に有用です。