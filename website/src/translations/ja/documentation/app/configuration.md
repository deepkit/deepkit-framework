# 設定

Deepkit アプリケーションでは、モジュールやアプリケーション自体に設定オプションを持たせることができます。たとえば、設定にはデータベースの URL、パスワード、IP などを含められます。サービス、HTTP/RPC/CLI コントローラ、テンプレート関数は依存性注入を通じてこれらの設定オプションを読み取れます。

設定は、プロパティを持つクラスを定義することで表現できます。これはアプリケーション全体の設定を型安全に定義する方法で、値は自動的にシリアライズおよび検証されます。

## 例

```typescript
import { MinLength } from '@deepkit/type';
import { App } from '@deepkit/app';

class Config {
    pageTitle: string & MinLength<2> = 'Cool site';
    domain: string = 'example.com';
    debug: boolean = false;
}

const app = new App({
    config: Config
});


app.command('print-config', (config: Config) => {
    console.log('config', config);
})

app.run();
```

```sh
$ curl http://localhost:8080/
Hello from Cool site via example.com
```

設定ローダーを使用しない場合は、既定値が使用されます。設定を変更するには、`app.configure({domain: 'localhost'})` メソッドを使うか、環境設定ローダーを使用します。

## 設定値の指定

デフォルトでは値は上書きされないため、既定値が使用されます。設定値を指定する方法はいくつかあります。

* `app.configure({})` 経由
* 各オプション用の環境変数
* JSON を用いた環境変数
* dotenv ファイル

複数の方法を同時に使って設定を読み込むことができます。呼び出し順が重要です。

### 環境変数

各設定オプションを個別の環境変数で設定できるようにするには、`loadConfigFromEnv` を使用します。既定のプレフィックスは `APP_` ですが、変更できます。`.env` ファイルも自動で読み込みます。デフォルトでは大文字の命名規則を使用しますが、これも変更できます。

上記の `pageTitle` のような設定オプションは、`APP_PAGE_TITLE="Other Title"` のようにして値を変更できます。

```typescript
new App({
    config: config,
    controllers: [MyWebsite],
})
    .loadConfigFromEnv({prefix: 'APP_'})
    .run();
```

```sh
APP_PAGE_TITLE="Other title" ts-node app.ts server:start
```

### JSON 環境変数

1 つの環境変数で複数の設定オプションを変更するには、`loadConfigFromEnvVariable` を使用します。最初の引数は環境変数名です。

```typescript
new App({
    config: config,
    controllers: [MyWebsite],
})
    .loadConfigFromEnvVariable('APP_CONFIG')
    .run();
```

```sh
APP_CONFIG='{"pageTitle": "Other title"}' ts-node app.ts server:start
```

### DotEnv ファイル

dotenv ファイルで複数の設定オプションを変更するには、`loadConfigFromEnv` を使用します。最初の引数は dotenv へのパス（`cwd` からの相対）または複数パスです。配列を渡した場合は、既存ファイルが見つかるまで各パスが順に試行されます。

```typescript
new App({
    config: config,
    controllers: [MyWebsite],
})
    .loadConfigFromEnv({envFilePath: ['production.dotenv', 'dotenv']})
    .run();
```

```sh
$ cat dotenv
APP_PAGE_TITLE=Other title
$ ts-node app.ts server:start
```

### モジュールの設定

各インポート済みモジュールにはモジュール名を持たせることができます。この名前は上記で使用した設定パスに用いられます。

たとえば環境変数で設定する場合、`FrameworkModule` のオプション port に対応するパスは `FRAMEWORK_PORT` です。すべての名前はデフォルトで大文字になります。プレフィックスに `APP_` を使う場合、次のようにしてポートを変更できます:

```sh
$ APP_FRAMEWORK_PORT=9999 ts-node app.ts server:start
2021-06-12T18:59:26.363Z [LOG] Start HTTP server, using 1 workers.
2021-06-12T18:59:26.365Z [LOG] HTTP MyWebsite
2021-06-12T18:59:26.366Z [LOG]     GET / helloWorld
2021-06-12T18:59:26.366Z [LOG] HTTP listening at http://localhost:9999/
```

dotenv ファイルでも同様に `APP_FRAMEWORK_PORT=9999` となります。

一方、`loadConfigFromEnvVariable('APP_CONFIG')` を介した JSON 環境変数では、実際の設定クラスの構造になります。`framework` はオブジェクトになります。

```sh
$ APP_CONFIG='{"framework": {"port": 9999}}' ts-node app.ts server:start
```

これはすべてのモジュールで同様に動作します。アプリケーションの設定オプション（`new App`）にはモジュールのプレフィックスは不要です。


## 設定クラス

```typescript
import { MinLength } from '@deepkit/type';

export class Config {
    title!: string & MinLength<2>; // 必須となり、値の指定が必要になります
    host?: string;

    debug: boolean = false; // 既定値もサポートされています
}
```

```typescript
import { createModuleClass } from '@deepkit/app';
import { Config } from './module.config.ts';

export class MyModule extends createModuleClass({
  config: Config
}) {
}
```

設定オプションの値は、モジュールのコンストラクタ、`.configure()` メソッド、または設定ローダー（例: 環境変数ローダー）で指定できます。

```typescript
import { MyModule } from './module.ts';

new App({
   imports: [new MyModule({title: 'Hello World'})],
}).run();
```

インポートされたモジュールの設定オプションを動的に変更するには、`process` フックを使用できます。ここは、現在のモジュール設定や他のモジュールインスタンス情報に応じて設定オプションを差し替えたり、インポート済みモジュールをセットアップしたりするのに適した場所です。

```typescript
import { MyModule } from './module.ts';

export class MainModule extends createModuleClass({
}) {
    process() {
        this.getImportedModuleByClass(MyModule).configure({title: 'Changed'});
    }
}
```

アプリケーションレベルでは少し動作が異なります:

```typescript
new App({
    imports: [new MyModule({title: 'Hello World'}],
})
    .setup((module, config) => {
        module.getImportedModuleByClass(MyModule).configure({title: 'Changed'});
    })
    .run();
```

ルートアプリケーションモジュールが通常のモジュールから作成される場合は、通常のモジュールと同様に動作します。

```typescript
class AppModule extends createModuleClass({
}) {
    process() {
        this.getImportedModuleByClass(MyModule).configure({title: 'Changed'});
    }
}

App.fromModule(new AppModule()).run();
```

## 設定値を読み取る

サービスで設定オプションを使用するには、通常の依存性注入を利用できます。設定オブジェクト全体、単一の値、または一部だけを注入することが可能です。

### 一部のみ

設定値のサブセットだけを注入するには、`Pick` 型を使用します。

```typescript
import { Config } from './module.config';

export class MyService {
     constructor(private config: Pick<Config, 'title' | 'host'}) {
     }

     getTitle() {
         return this.config.title;
     }
}


// ユニットテストでは、次のようにインスタンス化できます
new MyService({title: 'Hello', host: '0.0.0.0'});

// あるいは型エイリアスを使用できます
type MyServiceConfig = Pick<Config, 'title' | 'host'};
export class MyService {
     constructor(private config: MyServiceConfig) {
     }
}
```

### 単一値

単一の値だけを注入するには、インデックスアクセス演算子を使用します。

```typescript
import { Config } from './module.config';

export class MyService {
     constructor(private title: Config['title']) {
     }

     getTitle() {
         return this.title;
     }
}
```

### すべて

すべての設定値を注入するには、クラスを依存関係として使用します。

```typescript
import { Config } from './module.config';

export class MyService {
     constructor(private config: Config) {
     }

     getTitle() {
         return this.config.title;
     }
}
```