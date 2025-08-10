# Deepkit Broker

Deepkit Broker は、メッセージキュー、メッセージバス、イベントバス、Pub/Sub、キー/バリューストア、キャッシュ、そしてアトミック操作のための高性能な抽象化です。型安全性を重視し、自動シリアライゼーションとバリデーション、高性能、スケーラビリティを備えています。

Deepkit Broker はクライアントとサーバーを兼ね備えています。スタンドアロンのサーバーとして、または他の Deepkit Broker サーバーに接続するクライアントとして使用できます。マイクロサービスアーキテクチャ向けに設計されていますが、モノリシックアプリケーションでも使用できます。

クライアントはアダプタパターンを用いてさまざまなバックエンドをサポートします。異なるバックエンドでも同じコードを使え、同時に複数のバックエンドを使うこともできます。

現在、利用可能なアダプターは 3 つあります。1 つはデフォルトの `BrokerDeepkitAdapter` で、Deepkit Broker サーバーと通信し、Deepkit Broker（サーバーを含む）に同梱されています。
2 つ目は [@deepkit/broker-redis](./package/broker-redis) にある `BrokerRedisAdapter` で、Redis サーバーと通信します。3 つ目はテスト目的のインメモリアダプターである `BrokerMemoryAdapter` です。

## インストール

[Deepkit Framework](./framework.md) を使用する場合、Deepkit Broker はデフォルトでインストールおよび有効化されます。そうでない場合は、次のコマンドでインストールできます:

```bash
npm install @deepkit/broker
```

## Broker クラス

Deepkit Broker は次の主要なブローカークラスを提供します:

- **BrokerCache** - キャッシュ無効化を備えた L2 キャッシュ抽象化
- **BrokerBus** - メッセージバス (Pub/Sub)
- **BrokerQueue** - キューシステム
- **BrokerLock** - 分散ロック
- **BrokerKeyValue** - キー/バリューストア

これらのクラスは、型安全な方法でブローカーサーバーと通信するためにブローカーアダプターを受け取るよう設計されています。

```typescript
import { BrokerBus, BrokerMemoryAdapter } from '@deepkit/broker';

const bus = new BrokerBus(new BrokerMemoryAdapter());
const channel = bus.channel<{ foo: string }>('my-channel-name');
await channel.subscribe((message) => {
  console.log('received message', message);
});

await channel.publish({ foo: 'bar' });
```

FrameworkModule はデフォルトアダプターを提供・登録し、デフォルトでは同一プロセスで動作する Deepkit Broker サーバーに接続します。

ランタイム型と `channel<Type>('my-channel-name');` という呼び出しのおかげで、すべてが型安全になり、メッセージはアダプター内で自動的にバリデーションとシリアライズを行えます。
デフォルト実装の `BrokerDeepkitAdapter` はこれを自動で処理します（シリアライゼーションには BSON を使用）。

各ブローカークラスには独自のアダプターインターフェースがあるため、必要なメソッドのみを実装できます。`BrokerDeepkitAdapter` はこれらすべてのインターフェースを実装しており、すべてのブローカー API で使用できます。

## アプリケーションへの統合

これらのクラスを依存性注入とともに Deepkit アプリケーションで使用するには、次の機能を提供する `FrameworkModule` を使用します:

- ブローカーサーバー用のデフォルトアダプター
- ブローカーサーバー本体（自動起動を含む）
- すべてのブローカークラスのプロバイダー登録

`FrameworkModule` は、指定された設定に基づいて構成済みのブローカーサーバー用デフォルトブローカーアダプターを提供します。
また、すべてのブローカークラスのプロバイダーを登録するため、それら（例: BrokerBus）をサービスやプロバイダーファクトリに直接注入できます。

```typescript
// 別ファイル（例: broker-channels.ts）
type MyBusChannel = BrokerBusChannel<MyMessage>;

const app = new App({
  providers: [
    Service,
    provide<MyBusChannel>((bus: BrokerBus) => bus.channel<MyMessage>('my-channel-name')),
  ],
  imports: [new FrameworkModule({
    broker: {
      // startOnBootstrap が true の場合、ブローカーサーバーはこのアドレスで起動します。Unix ソケットのパスまたは host:port の組み合わせ
      listen: 'localhost:8811', // または 'var/broker.sock';
      // 別のブローカーサーバーを使用する場合は、そのアドレスを指定します。Unix ソケットのパスまたは host:port の組み合わせ。
      host: 'localhost:8811', // または 'var/broker.sock';
      // メインプロセスで単一のブローカーを自動的に起動します。カスタムのブローカーノードがある場合は無効にしてください。
      startOnBootstrap: true,
    },
  })],
});
```

その後、ブローカーの派生クラス（またはブローカークラス自体）をサービスに注入できます:

```typescript
import { MyBusChannel } from './broker-channels.ts';

class Service {
  constructor(private bus: MyBusChannel) {
  }

  async addUser() {
    await this.bus.publish({ foo: 'bar' });
  }
}
```

チャンネルの派生型（上の `MyBusChannel` のような）を作るのは常に良いアイデアです。これにより、サービスへ簡単に注入できます。
そうしない場合、毎回 `BrokerBus` を注入して `channel<MyMessage>('my-channel-name')` を呼び出す必要があり、ミスを招きやすく DRY ではありません。

ほぼすべてのブローカークラスでこの種の派生が可能なため、1 か所で定義してどこでも使えます。詳細は該当するブローカークラスのドキュメントを参照してください。

## カスタムアダプター

カスタムアダプターが必要な場合は、`@deepkit/broker` にある次のインターフェースのうち 1 つ以上を実装して独自のアダプターを作成できます:

```typescript
export type BrokerAdapter = BrokerAdapterCache & BrokerAdapterBus & BrokerAdapterLock & BrokerAdapterQueue & BrokerAdapterKeyValue;
```

```typescript
import { BrokerAdapterBus, BrokerBus, Release } from '@deepkit/broker';
import { Type } from '@deepkit/type';

class MyAdapter implements BrokerAdapterBus {
  disconnect(): Promise<void> {
    // 実装: ブローカーサーバーから切断する
  }
  async publish(name: string, message: any, type: Type): Promise<void> {
    // 実装: ブローカーサーバーへメッセージを送信する。name は 'my-channel-name'、message は { foo: 'bar' }
  }
  async subscribe(name: string, callback: (message: any) => void, type: Type): Promise<Release> {
    // 実装: ブローカーサーバーを購読する。name は 'my-channel-name'
  }
}

// もしくはデフォルトアダプターとして BrokerDeepkitAdapter を使用
const adapter = new MyAdapter;
const bus = new BrokerBus(adapter);

```

## ブローカーサーバー

`FrameworkModule` をインポートして `server:start` コマンドを実行すると、デフォルトでブローカーサーバーが自動的に起動します。
すべてのブローカークラスは、デフォルトでこのサーバーに接続するよう構成されています。

本番環境では、ブローカーサーバーを別プロセスまたは別マシンで実行します。
`server:start` の代わりに `server:broker:start` でブローカーサーバーを起動します。

トラフィックが多くスケーラビリティが必要な場合は、代わりに [redis adapter](./package/broker-redis.md) を使用すべきです。Redis サーバーを実行する必要があるためセットアップはやや複雑ですが、より高性能で多くのトラフィックを処理できます。

```bash
ts-node app.ts server:broker:start
```

これは、例えば `new FrameworkModule({broker: {listen: 'localhost:8811'}})` で設定したホスト上でサーバーを起動します。
`app.loadConfigFromEnv({prefix: 'APP_', namingStrategy: 'upper'});` を有効にしていれば、環境変数でアドレスを変更することもできます:

```bash
APP_FRAMEWORK_BROKER_LISTEN=localhost:8811 ts-node app.ts server:broker:start
```

サーバーを手動で起動する場合は、アプリケーション設定の `startOnBootstrap: false` によって自動ブローカーサーバー起動を無効化することを忘れないでください。