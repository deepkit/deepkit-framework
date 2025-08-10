# モジュール

Deepkit は高いモジュール性を持ち、アプリケーションを便利な複数のモジュールに分割できます。各モジュールは独自の依存性注入サブコンテナ（親の Provider をすべて継承）・設定・コマンドなどを持ちます。
[はじめに](../framework.md) では、すでに 1 つのモジュール（ルートモジュール）を作成しました。`new App` はモジュールとほぼ同じ引数を取り、内部で自動的にルートモジュールを作成します。

アプリケーションをサブモジュールに分割する予定がない場合、またはモジュールを他者に提供するパッケージとして公開する予定がない場合は、この章はスキップできます。

モジュールはクラスモジュールとして、または関数型モジュールとして定義できます。

```typescript title=クラス モジュール
import { createModuleClass } from '@deepkit/app';

export class MyModule extends createModuleClass({
  //new App({}) と同じオプション
  providers: [MyService]
}) {
}
```

```typescript title=関数型モジュール
import { AppModule } from '@deepkit/app';

export function myModule(options: {} = {}) {
    return (module: AppModule) => {
        module.addProvider(MyService);
    };
}
```

このモジュールは、その後アプリケーションや他のモジュールにインポートできます。

```typescript
import { MyModule, myModule } from './module.ts'

new App({
    imports: [
        new MyModule(), //クラス モジュールをインポート
        myModule(), //関数型モジュールをインポート
    ]
}).run();
```

`App` と同様に、このモジュールに機能を追加できます。`createModule` の引数は同じですが、モジュール定義では imports は使用できません。
関数型モジュールでは、`AppModule` のメソッドを使って、独自のオプションに基づいて動的に構成できます。

HTTP/RPC/CLI コントローラ、サービス、設定、イベントリスナー、各種モジュールフックを追加して、モジュールをより動的にします。

## コントローラ

モジュールは、他のモジュールによって処理されるコントローラを定義できます。例えば、`@deepkit/http` パッケージのデコレータを持つコントローラを追加すると、その `HttpModule` がこれを検出し、見つかったルートをルーターに登録します。1 つのコントローラに複数のデコレータを含めることもできます。これらのデコレータを提供するモジュールの作者が、コントローラをどのように処理するかを決定します。

Deepkit には、そのようなコントローラを処理するパッケージが 3 つあります: HTTP、RPC、CLI。詳細はそれぞれの章を参照してください。以下は HTTP コントローラの例です:

```typescript
import { createModuleClass } from '@deepkit/app';
import { http } from '@deepkit/http';
import { injectable } from '@deepkit/injector';

class MyHttpController {
  @http.GET('/hello)
  hello() {
    return 'Hello world!';
  }
}

export class MyModule extends createModuleClass({
  controllers: [MyHttpController]
}) {
}


//App でも同様
new App({
  controllers: [MyHttpController]
}).run();
```

## Provider

アプリケーションの `providers` セクションに Provider を定義すると、アプリ全体でアクセスできます。しかしモジュールの場合、これらの Provider はそのモジュールの依存性注入サブコンテナに自動的にカプセル化されます。別のモジュールやアプリケーションで利用できるようにするには、各 Provider を手動で export する必要があります。

Provider の仕組みの詳細は、[依存性注入](../dependency-injection.md) の章を参照してください。

```typescript
import { createModuleClass } from '@deepkit/app';
import { http } from '@deepkit/http';
import { injectable } from '@deepkit/injector';

export class HelloWorldService {
  helloWorld() {
    return 'Hello there!';
  }
}

class MyHttpController {
  constructor(private helloService: HelloWorldService) {
  }

  @http.GET('/hello)
  hello() {
    return this.helloService.helloWorld();
  }
}

export class MyModule extends createModuleClass({
  controllers: [MyHttpController],
  providers: [HelloWorldService],
}) {
}

export function myModule(options: {} = {}) {
  return (module: AppModule) => {
    module.addController(MyHttpController);
    module.addProvider(HelloWorldService);
  };
}

//App でも同様
new App({
  controllers: [MyHttpController],
  providers: [HelloWorldService],
}).run();
```

ユーザーがこのモジュールをインポートしても、`HelloWorldService` にはアクセスできません。これは、`MyModule` のサブ依存性注入コンテナにカプセル化されているためです。

## エクスポート

インポート側のモジュールで Provider を利用可能にするには、その Provider のトークンを `exports` に含めます。これは実質的に、その Provider を 1 つ上の親モジュール（インポート側）の依存性注入コンテナに移動します。

```typescript
import { createModuleClass } from '@deepkit/app';

export class MyModule extends createModuleClass({
  exports: [HelloWorldService],
}) {
}

export function myModule(options: {} = {}) {
  return (module: AppModule) => {
    module.addExport(HelloWorldService);
  };
}
```

`FactoryProvider` や `UseClassProvider` など他の Provider を使用している場合でも、exports にはクラスの型のみを指定してください。

```typescript
import { createModuleClass } from '@deepkit/app';

export class MyModule extends createModuleClass({
  controllers: [MyHttpController]
  providers: [
    { provide: HelloWorldService, useValue: new HelloWorldService }
  ],
  exports: [HelloWorldService],
}) {
}
```

これで、そのモジュールをインポートし、アプリケーションコードでエクスポートされたサービスを使用できます。

```typescript
import { App } from '@deepkit/app';
import { cli, Command } from '@deepkit/app';
import { HelloWorldService, MyModule } from './my-module';

@cli.controller('test')
export class TestCommand implements Command {
    constructor(protected helloWorld: HelloWorldService) {
    }

    async execute() {
        this.helloWorld.helloWorld();
    }
}

new App({
    controllers: [TestCommand],
    imports: [
        new MyModule(),
    ]
}).run();
```

詳しくは [依存性注入](../dependency-injection.md) の章を参照してください。


### 設定スキーマ

モジュールには型安全な設定オプションを持たせることができます。これらの値は、そのモジュールのサービスにクラス参照や `Partial<Config, 'url'>` のような型関数を使って部分的または全体を注入できます。設定スキーマを定義するには、プロパティを持つクラスを記述します。

```typescript
export class Config {
    title!: string; //必須で、値の提供が必要
    host?: string; //任意

    debug: boolean = false; //デフォルト値もサポートされます
}
```

```typescript
import { createModuleClass } from '@deepkit/app';
import { Config } from './module.config.ts';

export class MyModule extends createModuleClass({
  config: Config
}) {
}

export function myModule(options: Partial<Config> = {}) {
  return (module: AppModule) => {
    module.setConfigDefinition(Config).configure(options);
  };
}
```

設定オプションの値は、モジュールのコンストラクタ、`.configure()` メソッド、または設定ローダー（例: 環境変数ローダー）を通じて提供できます。

```typescript
import { MyModule } from './module.ts';

new App({
   imports: [
       new MyModule({title: 'Hello World'}),
       myModule({title: 'Hello World'}),
   ],
}).run();
```

インポートしたモジュールの設定オプションを動的に変更するには、`process` モジュールフックを使用できます。これは、現在のモジュールの設定や他のモジュールインスタンス情報に応じて、インポートしたモジュールの設定を転送したりセットアップしたりするのに適した場所です。


```typescript
import { MyModule } from './module.ts';

export class MainModule extends createModuleClass({
}) {
    process() {
        this.getImportedModuleByClass(MyModule).configure({title: 'Changed'});
    }
}

export function myModule(options: Partial<Config> = {}) {
    return (module: AppModule) => {
        module.getImportedModuleByClass(MyModule).configure({title: 'Changed'});
    };
}
```

アプリケーションレベルでは、少し異なります:

```typescript
new App({
    imports: [new MyModule({title: 'Hello World'}],
})
    .setup((module, config) => {
        module.getImportedModuleByClass(MyModule).configure({title: 'Changed'});
    })
    .run();
```

ルートアプリケーションモジュールが通常のモジュールから作成されている場合は、通常のモジュールと同様に動作します。

```typescript
class AppModule extends createModuleClass({
}) {
    process() {
        this.getImportedModuleByClass(MyModule).configure({title: 'Changed'});
    }
}

App.fromModule(new AppModule()).run();
```

## モジュール名

すべての設定オプションは、環境変数でも変更できます。これは、モジュールに名前が割り当てられている場合にのみ機能します。モジュール名は `createModule` で定義でき、インスタンス生成時に動的に変更することもできます。後者のパターンは、同じモジュールを 2 回インポートして新しい名前を設定して区別したい場合に便利です。

```typescript
export class MyModule extends createModuleClass({
  name: 'my'
}) {
}

export function myModule(options: Partial<Config> = {}) {
    return (module: AppModule) => {
        module.name = 'my';
    };
}
```

```typescript
import { MyModule } from './module';

new App({
    imports: [
        new MyModule(), //'my' がデフォルト名
        new MyModule().rename('my2'), //'my2' が新しい名前
    ]
}).run();
```

環境変数や .env ファイルから設定オプションを読み込む方法の詳細は、[設定](./configuration.md) の章を参照してください。

## インポート

モジュールは、機能を拡張するために他のモジュールをインポートできます。`App` では、モジュール定義オブジェクトの `imports: []` で他のモジュールをインポートできます:

```typescript
new App({
    imports: [new Module]
}).run();
```

通常のモジュールでは、これはできません。定義オブジェクト内でインスタンス化するとグローバルになってしまい、通常は望ましくないためです。代わりに、`imports` プロパティを介してモジュール自身の中でインスタンス化でき、モジュールの各新しいインスタンスごとに、各インポートモジュールのインスタンスが作成されます。

```typescript
import { createModuleClass } from '@deepkit/app';

export class MyModule extends createModuleClass({}) {
  imports = [new OtherModule()];
}

export function myModule() {
  return (module: AppModule) => {
    module.addImport(new OtherModule());
  };
}
```

`process` フックを使用して、設定に基づいてモジュールを動的にインポートすることもできます。

```typescript
import { createModuleClass } from '@deepkit/app';

export class MyModule extends createModuleClass({}) {
  process() {
    if (this.config.xEnabled) {
      this.addImport(new OtherModule({ option: 'value' });
    }
  }
}

export function myModule(option: { xEnabled?: boolean } = {}) {
  return (module: AppModule) => {
    if (option.xEnabled) {
      module.addImport(new OtherModule());
    }
  };
}
```

## フック

サービスコンテナは、ルート/アプリケーションモジュールから開始して、インポートされた順にすべてのモジュールを読み込みます。

この過程で、サービスコンテナは登録されたすべての設定ローダーを実行し、`setupConfig` コールバックを呼び出し、各モジュールの設定オブジェクトを検証します。

サービスコンテナの読み込みプロセス全体は次のとおりです:

1. 各モジュール `T`（ルートから開始）について
    1. 設定ローダー `ConfigLoader.load(T)` を実行。
    2. `T.setupConfig()` を呼び出す。
    3. `T` の設定を検証。無効なら中止。
    4. `T.process()` を呼び出す。  
       ここでモジュールは、有効な設定オプションに基づいて自分自身を変更できます。新しい import や provider などを追加します。
    5. `T` の各インポートモジュールについて 1. を繰り返す。
3. 登録されたすべてのモジュールを見つける。
4. 見つかった各モジュール `T` を処理する。
    1. `T` のミドルウェアを登録。
    2. イベントディスパッチャに `T` のリスナーを登録。
    3. 2. で見つかったすべてのモジュールに対して `Module.processController(T, controller)` を呼び出す。
    4. 2. で見つかったすべてのモジュールに対して `Module.processProvider(T, token, provider)` を呼び出す。
    5. `T` の各インポートモジュールについて 3. を繰り返す。
5. すべてのモジュールで `T.postProcess()` を実行。
6. すべてのモジュールでブートストラップクラスをインスタンス化。
7. 依存性注入コンテナが構築される。

フックを使用するには、モジュールクラスに `process`、`processProvider`、`postProcess` メソッドを登録します。

```typescript
import { createModuleClass, AppModule } from '@deepkit/app';
import { isClass } from '@deepkit/core';
import { ProviderWithScope, Token } from '@deepkit/injector';

export class MyModule extends createModuleClass({}) {
  imports = [new FrameworkModule()];

  //最初に実行される
  process() {
    //this.config には完全に検証された設定オブジェクトが入っています。
    if (this.config.environment === 'development') {
      this.getImportedModuleByClass(FrameworkModule).configure({ debug: true });
    }
    this.addModule(new AnotherModule);
    this.addProvider(Service);

    //追加のセットアップメソッドを呼び出します。
    //この例では、依存性注入コンテナが Service をインスタンス化する際に
    //'method1' を指定の引数で呼び出します。
    this.configureProvider<Service>(v => v.method1(this.config.value));
  }

  //すべてのモジュールで見つかった各 Provider に対して実行される
  processController(module: AppModule<any>, controller: ClassType) {
    //例えば HttpModule は、各コントローラに @http デコレータが使われているか確認し、
    //使われていればすべてのルート情報を抽出してルーターに登録します。
  }

  //すべてのモジュールで見つかった各 Provider に対して実行される
  processProvider(module: AppModule<any>, token: Token, provider: ProviderWithScope) {
    //例えば FrameworkModule は、deepkit/orm の Database を拡張するトークンを探し、
    //それらを自動的に DatabaseRegistry に登録して、マイグレーション CLI コマンドや
    //Framework Debugger で使用できるようにします。
  }

  //すべてのモジュールの処理が完了したときに実行される。
  //process/processProvider で処理した情報に基づいて、
  //module.configureProvider で Provider をセットアップする最後のチャンス。
  postProcess() {

  }
}
```

## 状態を持つモジュール

各モジュールは `new Module` で明示的にインスタンス化されるため、モジュールは状態を持つことができます。この状態は依存性注入コンテナに注入でき、サービスで使用できるようになります。

例として HttpModule のユースケースを考えます。これはアプリケーション全体で登録された各コントローラをチェックし、@http デコレータが付いていればレジストリに登録します。このレジストリは Router に注入され、Router がインスタンス化されると、それらのコントローラのすべてのルート情報を抽出して登録します。

```typescript
class Registry {
    protected controllers: { module: AppModule<any>, classType: ClassType }[] = [];
        
    register(module: AppModule<any>, controller: ClassType) {
        this.controllers.push({ module, classType: controller });
    }
        
    get(classType: ClassType) {
        const controller = this.controllers.find(v => v.classType === classType);
        if (!controller) throw new Error('Controller unknown');
        return controller;
    }
}
        
class Router {
    constructor(
        protected injectorContext: InjectorContext,
        protected registry: Registry
    ) {
    }
        
    getController(classType: ClassType) {
        //指定の controller の classType に対応する classType と module を見つける
        const controller = this.registry.get(classType);
        
        //ここでコントローラがインスタンス化されます。すでにインスタンス化されている場合は
        //（provider が transient: true でない限り）以前のインスタンスが返されます
        return injector.get(controller.classType, controller.module);
    }
}
        
class HttpModule extends createModuleClass({
    providers: [Router],
    exports: [Router],
}) {
    protected registry = new Registry;
        
    process() {
        this.addProvider({ provide: Registry, useValue: this.registry });
    }
        
    processController(module: AppModule<any>, controller: ClassType) {
        //コントローラは、コントローラの利用側によって module の providers に追加される必要があります
        if (!module.isProvided(controller)) module.addProvider(controller);
        this.registry.register(module, controller);
    }
}
        
class MyController {}
        
const app = new App({
    controllers: [MyController],
    imports: [new HttpModule()]
});
        
const myController = app.get(Router).getController(MyController);
```

## root 用

`root` プロパティを使うと、モジュールの依存性注入コンテナをルートアプリケーションのコンテナに移動できます。これにより、そのモジュールのすべてのサービスが、ルートアプリケーションから自動的に利用可能になります。基本的には、各 Provider（コントローラ、イベントリスナー、Provider）をルートコンテナに移動します。これは依存関係の競合を引き起こす可能性があるため、本当にグローバルなものしか持たないモジュールにのみ使用すべきです。代わりに、各 Provider を手動で export することを推奨します。

多くのモジュールで使用できるライブラリを構築する場合は、`root` の使用は避けるべきです。他のライブラリの Provider トークンと競合する可能性があるためです。例えば、このライブラリモジュールが `foo` モジュールをインポートし、そこで定義されたサービスを自分用に再構成し、ユーザーのアプリケーションも同じ `foo` モジュールをインポートする場合、ユーザーはあなたが再構成したサービスを受け取ることになります。多くの単純なユースケースでは問題ないかもしれませんが、注意が必要です。

```typescript
import { createModuleClass } from '@deepkit/app';

export class MyModule extends createModuleClass({}) {
  root = true;
}
```

サードパーティモジュールの `root` プロパティを `forRoot()` を使って変更することもできます。

```typescript
new App({
    imports: [new ThirdPartyModule().forRoot()],
}).run();
```

## Injector Context

InjectorContext は依存性注入コンテナです。自分のモジュールや他のモジュールからサービスを要求/インスタンス化できます。例えば、`processControllers` にコントローラを保存しておき、それらを正しくインスタンス化したい場合に必要になります。