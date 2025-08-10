# ブローカーキャッシュ

Deepkit Broker Cache クラスは多層（2 層）のキャッシュで、メモリ内に揮発性のローカルキャッシュを保持し、データがキャッシュ内にない、古い、または無効化されている場合にのみブローカーサーバーからデータを取得します。これにより、非常に高いパフォーマンスと低レイテンシーのデータ取得のためにキャッシュを活用できます。

このキャッシュは型安全に設計されており、データを自動的にシリアライズ/デシリアライズします（BSON を使用）。また、キャッシュの無効化およびクリアをサポートします。実装では、同じキャッシュ項目に同時に複数のリクエストがアクセスしようとしても、プロセスごとにキャッシュが再構築されるのは一度だけであることを保証します。

データはサーバーに永続化されず、メモリ内にのみ保持されます。サーバーが再起動すると、すべてのデータは失われます。

## 使用方法

BrokerCache が依存性注入コンテナで利用できるようにアプリケーションを正しく設定する方法については、入門ページを必ずお読みください。

Deepkit Broker におけるキャッシュ抽象は単純なキー/バリュー ストアとは大きく異なります。キャッシュ名とビルダー関数を定義することで動作し、キャッシュが空または古い場合に自動的に呼び出されます。このビルダー関数は、キャッシュに保存されるデータを構築する役割を担います。

```typescript
import { BrokerCache, BrokerCacheItem } from '@deepkit/broker';

const cache = new BrokerCache(adapter);

const cacheItem = cache.item('my-cache', async () => {
  // これは、キャッシュが空または古い場合に呼び出される
  // ビルダー関数です
  return 'hello world';
});


// キャッシュが古いか空かを確認
await cacheItem.exists();

// キャッシュからデータを取得するか、ブローカーサーバーから取得します
// キャッシュが空または古い場合はビルダー関数が呼び出され
// その結果が返され、ブローカーサーバーへ送信されます。
const topUsers = await cacheItem.get();

// キャッシュを無効化すると、次の get() 呼び出しで 
// ビルダー関数が再度呼び出されます。
// ローカルキャッシュとサーバーキャッシュをクリアします。
await cacheItem.invalidate();

// キャッシュにデータを手動で設定
await cacheItem.set(xy);
```

## アプリでの使用

アプリケーションで BrokerCache を使用するための完全な例。
`FrameworkModule` をインポートすると、このクラスは依存性注入コンテナで自動的に利用可能になります。
詳細は入門ページを参照してください。

```typescript
import { BrokerCache, BrokerCacheItem } from '@deepkit/broker';
import { FrameworkModule } from '@deepkit/framework';

// これらの型は共通ファイルで定義しておくと再利用でき、
// サービスに注入することもできます
type MyCacheItem = BrokerCacheItem<User[]>;

function createMyCache(cache: BrokerCache, database: Database) {
  return cache.item<User[]>('top-users', async () => {
    // これは、キャッシュが空または古い場合に呼び出される
    // ビルダー関数です
    return await database.query(User)
      .limit(10).orderBy('score').find();
  });
}

class Service {
  constructor(private cacheItem: MyCacheItem) {
  }

  async getTopUsers() {
    return await this.cacheItem.get();
  }
}

const app = new App({
  providers: [
    Service,
    Database,
    provide<MyCacheItem>(createMyCache),
  ],
  imports: [
    new FrameworkModule(),
  ],
});

const cacheItem = app.get<MyCacheItem>();

// キャッシュからデータを取得するか、ブローカーサーバーから取得します
const topUsers = await cacheItem.get();
```