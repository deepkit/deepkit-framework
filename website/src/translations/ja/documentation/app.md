# Deepkit App

Deepkit App の抽象は Deepkit アプリケーションの最も基本的な構成要素です。ライブラリを単体で使用しない場合、通常はここからアプリケーションの構築を始めます。
これは Node.js のようなランタイムで実行する通常の TypeScript ファイルです。アプリケーションのエントリポイントであり、CLI コマンド、サービス、
設定、イベントなどを定義する方法を提供します。

Command-line Interface (CLI) プログラムは、テキスト入力とテキスト出力の形でターミナル経由で対話するプログラムです。この形態でアプリケーションと対話する利点は、
ローカルまたは SSH 接続経由のいずれかでターミナルさえあればよい点です。

提供するもの:

- CLI コマンド
- モジュールシステム
- サービスコンテナ
- 依存性注入
- イベントシステム
- ロガー
- 設定ローダー（env, dotenv, json）

Deepkit のコマンドは DI コンテナへ完全にアクセスできるため、すべてのプロバイダや設定オプションにアクセスできます。CLI コマンドの引数とオプションは
TypeScript の型によるパラメータ宣言で制御され、自動的にシリアライズおよび検証されます。

[Deepkit フレームワーク](./framework.md) の `@deepkit/framework` はこれをさらに拡張し、HTTP/RPC 用のアプリケーションサーバ、デバッガ/プロファイラなどを提供します。

## 簡単なインストール

最も簡単な始め方は、NPM init を使って新しい Deepkit プロジェクトを作成することです。

```shell
npm init @deepkit/app@latest my-deepkit-app
````

これにより、新しいフォルダー `my-deepkit-app` が作成され、すべての依存関係と基本的な `app.ts` ファイルが含まれます。

```sh
cd my-deepkit-app
npm run app
````

これにより `ts-node` で `app.ts` ファイルが実行され、利用可能なコマンドが表示されます。ここから開始して、独自のコマンド、コントローラなどを追加できます。

## 手動インストール

Deepkit App は [Deepkit ランタイム型](./runtime-types.md) を基盤としているため、すべての依存関係をインストールします:

```bash
mkdir my-project && cd my-project

npm install typescript ts-node 
npm install @deepkit/app @deepkit/type @deepkit/type-compiler
```

次に、以下のコマンドを実行して、Deepkit の型コンパイラが `node_modules/typescript` にあるインストール済みの TypeScript パッケージへ導入されていることを確認します:

```sh
./node_modules/.bin/deepkit-type-install
```

すべての peer 依存関係がインストールされていることを確認してください。デフォルトでは NPM 7+ が自動的にインストールします。

アプリケーションをコンパイルするには TypeScript コンパイラが必要で、アプリを容易に実行するために `ts-node` の使用を推奨します。

`ts-node` を使用しない代替としては、TypeScript コンパイラでソースコードをコンパイルし、生成された JavaScript を直接実行する方法があります。これは短いコマンドの
実行速度を劇的に向上させる利点があります。ただし、コンパイラを手動で実行するかウォッチャーを設定するかのいずれかで、ワークフローに追加のオーバーヘッドが生じます。
このため、本ドキュメントのすべての例では `ts-node` を使用しています。

## 最初のアプリケーション

Deepkit フレームワークは設定ファイルや特別なフォルダ構成を使用しないため、プロジェクトは自由に構成できます。開始するのに必要なのは、TypeScript の app.ts ファイルと
TypeScript の設定 tsconfig.json の2つだけです。

プロジェクトフォルダには次のファイルがある状態を目指します:

```
.
├── app.ts
├── node_modules
├── package-lock.json
└── tsconfig.json
```

基本的な tsconfig を設定し、`reflection` を `true` に設定して Deepkit の型コンパイラを有効にします。
これは依存性注入コンテナやその他の機能を使用するために必要です。

```json title=tsconfig.json
{
  "compilerOptions": {
    "outDir": "./dist",
    "experimentalDecorators": true,
    "strict": true,
    "esModuleInterop": true,
    "target": "es2020",
    "module": "CommonJS",
    "moduleResolution": "node"
  },
  "reflection": true,
  "files": [
    "app.ts"
  ]
}
```

```typescript title=app.ts
import { App } from '@deepkit/app';
import { Logger } from '@deepkit/logger';

const app = new App();

app.command('test', (logger: Logger) => {
    logger.log('Hello World!');
});

app.run();
```

このコードでは、test コマンドを定義し、`run()` を使って直接実行する新しいアプリを作成しています。このスクリプトを実行するとアプリが起動します。

そしてそのまま実行します。

```sh
$ ./node_modules/.bin/ts-node app.ts
VERSION
  Node

USAGE
  $ ts-node app.ts [COMMAND]

TOPICS
  debug
  migration  Executes pending migration files. Use migration:pending to see which are pending.
  server     Starts the HTTP server

COMMANDS
  test
```

次に、test コマンドを実行するには次のコマンドを実行します。

```sh
$ ./node_modules/.bin/ts-node app.ts test
Hello World
```

Deepkit では、以降の操作はすべてこの `app.ts` 経由で行います。ファイル名は自由に変更したり、複数作成したりできます。カスタム CLI コマンド、HTTP/RPC サーバ、
マイグレーションコマンドなどはすべてこのエントリポイントから起動されます。

## 引数とフラグ

Deepkit App は関数のパラメータを自動的に CLI の引数とフラグに変換します。パラメータの順序が CLI 引数の順序を決定します。

パラメータは任意の TypeScript の型にでき、自動的に検証およびデシリアライズされます。

詳しくは章 [引数とフラグ](./app/arguments.md) を参照してください。

## 依存性注入

Deepkit App はサービスコンテナを設定し、インポートされた各モジュールに対して親から継承する独自の依存性注入コンテナを用意します。
これには標準で次のプロバイダが含まれており、サービス、コントローラ、イベントリスナに自動的に注入できます:

- `Logger` ログ出力用
- `EventDispatcher` イベント処理用
- `CliControllerRegistry` 登録済み CLI コマンド用
- `MiddlewareRegistry` 登録済みミドルウェア用
- `InjectorContext` 現在のインジェクタコンテキスト用

Deepkit フレームワークをインポートすると、さらに多くのプロバイダが利用可能になります。詳細は [Deepkit フレームワーク](./framework.md) を参照してください。

## 終了コード

終了コードはデフォルトで 0 で、これはコマンドが正常に実行されたことを意味します。終了コードを変更するには、execute メソッドまたはコマンドのコールバックで 0 以外の数値を返します。

```typescript

@cli.controller('test')
export class TestCommand {
    async execute() {
        console.error('Error :(');
        return 12;
    }
}
```