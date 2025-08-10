# Broker のアトミックロック

Deepkit Broker Locks は、複数のプロセスやマシンにまたがってアトミックロックを作成するためのシンプルな手段です。

あるコードブロックを一度に実行できるプロセスが1つだけであることを保証する簡単な方法です。

## 使い方

```typescript
import { BrokerLock } from '@deepkit/broker';

const lock = new BrokerLock(adapter);

// ロックの有効期間は60秒です。
// 取得のタイムアウトは10秒です。
const myLock = lock.item('my-lock', { ttl: '60s', timeout: '10s' });

async function criticalSection() {
  // 関数が完了するまでロックを保持します。
  // 関数がエラーを投げてもロックを自動的にクリーンアップします。
  await using hold = await lock1.hold();
}
```

このロックは[明示的リソース管理](https://github.com/tc39/proposal-explicit-resource-management)をサポートしており、適切にロックを解放するために try-catch ブロックを使用する必要がありません。

ロックを手動で取得および解放するには、`acquire` と `release` メソッドを使用できます。

```typescript
// ロックが取得されるまでブロックします。
// タイムアウトに達した場合は例外をスローします
await myLock.acquire();

try {
  // クリティカルな処理を実行する
} finally {
  await myLock.release();
}
```

## アプリケーションでの使用

アプリケーションで BrokerLock を使用するための完全な例です。
`FrameworkModule` をインポートすると、クラスは依存性注入コンテナで自動的に利用可能になります。
詳細は「はじめに」ページを参照してください。

```typescript
import { BrokerLock, BrokerLockItem } from '@deepkit/broker';
import { FrameworkModule } from '@deepkit/framework';

// この型は共有ファイルに移動してください
type MyCriticalLock = BrokerLockItem;

class Service {
  constructor(private criticalLock: MyCriticalLock) {
  }

  async doSomethingCritical() {
    await using hold = await this.criticalLock.hold();
    
    // クリティカルな処理を実行する
    // ロックは自動的に解放されます
  }
}

const app = new App({
  providers: [
    Service,
    provide<MyCriticalLock>((lock: BrokerLock) => lock.item('my-critical-lock', { ttl: '60s', timeout: '10s' })),
  ],
  imports: [
    new FrameworkModule(),
  ],
});
```