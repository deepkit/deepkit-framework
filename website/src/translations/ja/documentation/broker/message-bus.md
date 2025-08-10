# ブローカーバス

Deepkit メッセージバスは、アプリケーションの異なる部分間でメッセージやイベントを送受信できるメッセージバスシステム（Pub/Sub、分散イベントシステム）です。

マイクロサービス、モノリス、その他あらゆる種類のアプリケーションで使用できます。イベント駆動アーキテクチャに最適です。  

これはプロセス内イベントに使用される Deepkit Event システムとは異なります。ブローカーバスは、他のプロセスやサーバーに送る必要があるイベントに使用します。ブローカーバスは、例えば `new FrameworkModule({workers: 4})` のように FrameworkModule によって自動的に起動された複数のワーカー間で通信したい場合にも最適です。

このシステムは型安全に設計されており、メッセージを自動的にシリアライズ/デシリアライズします（BSON を使用）。メッセージの型に[検証](../runtime-types/validation.md)を追加すると、送信前および受信後にもメッセージを検証します。これにより、メッセージが常に正しい形式で、想定どおりのデータを含むことが保証されます。

## 使用方法

```typescript
import { BrokerBus } from '@deepkit/broker';

const bus = new BrokerBus(adapter);

// この型は共有ファイルに移動してください
type UserEvent = { type: 'user-created', id: number } | { type: 'user-deleted', id: number };

const channel = bus.channel<Events>('user-events');

await channel.subscribe((event) => {
  if (event.type === 'user-created') {
    console.log('User created', event.id);
  } else if (event.type === 'user-deleted') {
    console.log('User deleted', event.id);
  }
});

await channel.publish({ type: 'user-created', id: 1 });
```

チャネルに対して名前と型を定義することで、正しい型のメッセージだけが送受信されるようにできます。
データは自動的にシリアライズおよびデシリアライズされます（BSON を使用）。

## アプリでの使用

アプリケーションで BrokerBus を使用する方法の完全な例です。
`FrameworkModule` をインポートすると、このクラスは依存性注入コンテナで自動的に利用可能になります。
詳細は「はじめに」ページを参照してください。

### サブジェクト

デフォルトのメッセージ送受信方法は、rxjs の `Subject` 型を使用することです。その `subscribe` と `next` の各 Method により、型安全な方法でメッセージを送受信できます。すべての Subject インスタンスはブローカーによって管理され、Subject がガベージコレクションされると、サブスクリプションはブローカーのバックエンド（例: Redis）から削除されます。

メッセージの publish または subscribe に失敗した場合に対処するには、BrokerBus の `BusBrokerErrorHandler` をオーバーライドします。

このアプローチにより、業務コードをブローカーサーバーから適切に分離でき、ブローカーサーバーのないテスト環境でも同じコードを使用できます。

```typescript
import { BrokerBus, BrokerBusChannel, provideBusSubject } from '@deepkit/broker';
import { FrameworkModule } from '@deepkit/framework';
import { Subject } from 'rxjs';

// この型は共有ファイルに移動してください
type MyChannel = Subject<{
    id: number;
    name: string;
}>;

class Service {
    // MyChannel はシングルトンではなく、各リクエストごとに新しいインスタンスが作成されます。
    // そのライフタイムはフレームワークによって監視され、サブジェクトがガベージコレクションされると、 
    // サブスクリプションはブローカーのバックエンド（例: Redis）から削除されます。
    constructor(private channel: MyChannel) {
        this.channel.subscribe((message) => {
            console.log('received message', message);
        });
    }

    update() {
        this.channel.next({ id: 1, name: 'Peter' });
    }
}

@rpc.controller('my-controller')
class MyRpcController {
    constructor(private channel: MyChannel) {
    }

    @rpc.action()
    getChannelData(): MyChannel {
        return this.channel;
    }
}

const app = new App({
    controllers: [MyRpcController],
    providers: [
        Service,
        provideBusSubject<MyChannel>('my-channel'),
    ],
    imports: [
        new FrameworkModule(),
    ],
});
```

### バスチャネル 

メッセージが送信されたことの確認が必要で、各ケースでエラー処理を行いたい場合は、`BrokerBusChannel` 型を使用できます。`subscribe` と `publish` の各 Method は Promise を返します。

```typescript
import { BrokerBus, BrokerBusChannel, provideBusChannel } from '@deepkit/broker';
import { FrameworkModule } from '@deepkit/framework';

// この型は共有ファイルに移動してください
type MyChannel = BrokerBusChannel<{
    id: number;
    name: string;
}>;

class Service {
    constructor(private channel: MyChannel) {
        this.channel.subscribe((message) => {
            console.log('received message', message);
        }).catch(e => {
            console.error('Error while subscribing', e);
        });
    }

    async update() {
        await this.channel.publish({ id: 1, name: 'Peter' });
    }
}

const app = new App({
    providers: [
        Service,
        provideBusChannel<MyChannel>('my-channel'),
    ],
    imports: [
        new FrameworkModule(),
    ],
});
```