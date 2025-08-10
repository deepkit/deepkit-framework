# ブローカーキュー

Deepkit Message Queue は、メッセージをキューサーバーに送信し、ワーカーがそれらを処理できるメッセージキューシステムです。

このシステムは型安全に設計されており、メッセージを自動的にシリアライズ/デシリアライズします（BSON を使用）。

データはサーバーに永続化されるため、サーバーがクラッシュしてもデータは失われません。

## 使い方

```typescript
import { BrokerQueue, BrokerQueueChannel } from '@deepkit/broker';

const queue = new BrokerQueue(adapter);

type User = { id: number, username: string };

const registrationChannel = queue.channel<User>('user/registered', {
  process: QueueMessageProcessing.exactlyOnce,
  deduplicationInterval: '1s',
});

// ワーカーがメッセージを消費します。
// これは通常、別プロセスで行われます。
await registrationChannel.consume(async (user) => {
  console.log('User registered', user);
  // ここでワーカーがクラッシュしても、メッセージは失われません。
  // 別のワーカーに自動的に再配信されます。
  // このコールバックがエラーなく返ると、そのメッセージは 
  // 処理済みとしてマークされ、最終的に削除されます。
});

// メッセージを送信するアプリケーション
await registrationChannel.produce({ id: 1, username: 'Peter' });
```

## アプリでの使用

アプリケーションで BrokerQueue を使用する方法の完全な例です。
`FrameworkModule` をインポートすると、そのクラスは依存性注入コンテナで自動的に利用可能になります。
詳細は「はじめに」ページを参照してください。

キューシステムを最大限に活用するには、メッセージを消費する複数のワーカーを起動することを推奨します。
HTTP ルートなどを持つメインのアプリケーションとは別の App を作成します。

共通のサービスは共有アプリモジュールを通じて共有します。チャネルの定義は、アプリケーション全体で共通のファイルを介して共有します。

```typescript
// ファイル: channels.ts

export type RegistrationChannel = BrokerQueueChannel<User>;
export const registrationChannelProvider = provide<RegistrationChannel>((queue: BrokerQueue) => queue.channel<User>('user/registered', {
  process: QueueMessageProcessing.exactlyOnce,
  deduplicationInterval: '1s',
}));
```

```typescript
// ファイル: worker.ts
import { RegistrationChannel, registrationChannelProvider } from './channels';

async function consumerCommand(
  channel: RegistrationChannel, 
  database: Database) {

  await channel.consume(async (user) => {
    // ユーザーに対して何らかの処理を行います。
    // 情報を保存したり、メールを送信したり、など。
  });

  // ブローカーへの接続がプロセスを生かし続けます。
}

const app = new App({
  providers: [
    Database,
    registrationChannelProvider,
  ],
  imports: [
    new FrameworkModule({}),
  ],
});

app.command('consumer', consumerCommand);

// 上のワーカーコマンドを直接起動
void app.run('consumer');
```

そしてアプリケーションでは次のようにメッセージを送信します:

```typescript
// ファイル: app.ts
import { RegistrationChannel, registrationChannelProvider } from './channels';

class Service {
  constructor(private channel: RegistrationChannel) {
  }

  async registerUser(user: User) {
    await this.channel.produce(user);
  }
}

const app = new App({
  providers: [
    Service,
    registrationChannelProvider,
  ],
  imports: [
    new FrameworkModule({}),
  ],
});

void app.run();
```