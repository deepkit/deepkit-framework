# Broker Key-Value

Deepkit Broker Key-Value の Class は、ブローカーサーバーと連携するシンプルな key/value ストア抽象化です。ブローカーサーバーからデータを保存および取得する簡単な方法を提供します。

ローカルキャッシュは実装されていません。すべての `get` 呼び出しは毎回ブローカーサーバーへの実際のネットワークリクエストです。これを避けるには、Broker Cache の抽象化を使用してください。

データはサーバー上で永続化されず、メモリ上にのみ保持されます。サーバーが再起動すると、すべてのデータは失われます。

## 使い方

```typescript
import { BrokerKeyValue } from '@deepkit/broker';

const keyValue = new BrokerKeyValue(adapter, {
  ttl: '60s', // 各 key の有効期間。0 は ttl なし（デフォルト）を意味します。
});

const item = keyValue.item<number>('key1');

await item.set(123);
console.log(await item.get()); //123

await item.remove();
```

データは、指定された Type に基づき BSON を使用して自動的にシリアライズおよびデシリアライズされます。

Method `set` と `get` は `BrokerKeyValue` インスタンスで直接呼び出すこともできますが、その場合は毎回 key と Type を渡す必要があるという欠点があります。

```typescript
await keyValue.set<number>('key1', 123);
console.log(await keyValue.get<number>('key1')); //123
```

## インクリメント

`increment` Method は、指定した量で key の値をアトミックにインクリメントできます。

これはサーバー上に独自のストレージエントリを作成し、`set` や `get` とは互換性がないことに注意してください。 

```typescript

const activeUsers = keyValue.item<number>('activeUsers');

// 1 ずつアトミックにインクリメント
await activeUsers.increment(1);

await activeUsers.increment(-1);

// 現在の値を取得する唯一の方法は、0 を指定して increment を呼び出すことです
const current = await activeUsers.increment(0);

// エントリを削除します
await activeUsers.remove();
```

## アプリでの使用

アプリケーションで BrokerKeyValue を使用するための完全な例です。
`FrameworkModule` をインポートすると、その Class は依存性注入コンテナで自動的に利用可能になります。
詳しくは Getting started ページを参照してください。

```typescript
import { BrokerKeyValue, BrokerKeyValueItem } from '@deepkit/broker';
import { FrameworkModule } from '@deepkit/framework';

// この Type は共有ファイルに移動してください
type MyKeyValueItem = BrokerKeyValueItem<User[]>;

class Service {
  constructor(private keyValueItem: MyKeyValueItem) {
  }

  async getTopUsers(): Promise<User[]> {
    // undefined の可能性があります。この場合を処理する必要があります。
    // これを避けたい場合は Broker Cache を使用してください。
    return await this.keyValueItem.get();
  }
}

const app = new App({
  providers: [
    Service,
    provide<MyKeyValueItem>((keyValue: BrokerKeyValue) => keyValue.item<User[]>('top-users')),
  ],
  imports: [
    new FrameworkModule(),
  ],
});
```