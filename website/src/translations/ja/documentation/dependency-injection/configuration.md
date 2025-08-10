# 設定

依存性注入コンテナは、設定オプションの注入も可能です。設定の注入は、コンストラクタ注入またはプロパティ注入で受け取ることができます。

Module API は、設定定義（通常のクラス）の宣言をサポートしています。このクラスにプロパティを用意すると、各プロパティが設定オプションとして機能します。TypeScript におけるクラスの定義方法により、各プロパティごとに型やデフォルト値を定義できます。

```typescript
class RootConfiguration {
    domain: string = 'localhost';
    debug: boolean = false;
}

const rootModule = new InjectorModule([UserRepository])
     .setConfigDefinition(RootConfiguration)
     .addImport(lowLevelModule);
```

設定オプション `domain` と `debug` は、プロバイダ内で型安全に便利に使用できます。

```typescript
class UserRepository {
    constructor(private debug: RootConfiguration['debug']) {}

    getUsers() {
        if (this.debug) console.debug('fetching users ...');
    }
}
```

オプションの値は `configure()` で設定できます。

```typescript
	rootModule.configure({debug: true});
```

デフォルト値がないが必須なオプションは `!` を付けて指定できます。これにより、モジュールの利用者は値を必ず提供しなければならず、そうでない場合はエラーになります。

```typescript
class RootConfiguration {
    domain!: string;
}
```

## 検証

また、前章の[バリデーション](../runtime-types/validation.md)と[シリアライズ](../runtime-types/serialization.md)にあるすべてのシリアライズおよびバリデーションの型を使用して、オプションが満たすべき型および内容の制約を詳細に指定できます。

```typescript
class RootConfiguration {
    domain!: string & MinLength<4>;
}
```

## 注入

設定オプションは、他の依存関係と同様に、先に示したように DI コンテナを通じて安全かつ容易に注入できます。最も簡単な方法は、インデックスアクセス演算子を使って単一のオプションを参照することです。

```typescript
class WebsiteController {
    constructor(private debug: RootConfiguration['debug']) {}

    home() {
        if (this.debug) console.debug('visit home page');
    }
}
```

設定オプションは個別だけでなくグループとしても参照できます。この目的には TypeScript のユーティリティ型 `Partial` を使用します。

```typescript
class WebsiteController {
    constructor(private options: Partial<RootConfiguration, 'debug' | 'domain'>) {}

    home() {
        if (this.options.debug) console.debug('visit home page');
    }
}
```

すべての設定オプションを取得するには、設定クラス自体を直接参照することもできます。

```typescript
class WebsiteController {
    constructor(private options: RootConfiguration) {}

    home() {
        if (this.options.debug) console.debug('visit home page');
    }
}
```

ただし、実際に使用する設定オプションだけを参照することを推奨します。これはユニットテストを単純化するだけでなく、コードから実際に必要なものを把握しやすくします。