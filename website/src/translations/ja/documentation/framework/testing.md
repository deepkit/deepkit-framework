# テスト

Deepkit フレームワークのサービスとコントローラーは、設計の行き届いたカプセル化と分離を備えた、SOLID かつクリーンなコードをサポートするように設計されています。これらの特性により、コードはテストしやすくなります。

このドキュメントでは、`ts-jest` を用いてテストフレームワーク [Jest](https://jestjs.io) をセットアップする方法を説明します。これを行うには、次のコマンドを実行して `jest` と `ts-jest` をインストールします。

```sh
npm install jest ts-jest @types/jest
```

Jest がテストスイートの場所や TS コードのコンパイル方法を認識できるように、いくつかの設定オプションが必要です。`package.json` に次の設定を追加してください:

```json title=package.json
{
  ...,

  "jest": {
    "transform": {
      "^.+\\.(ts|tsx)$": "ts-jest"
    },
    "testEnvironment": "node",
    "testMatch": [
      "**/*.spec.ts"
    ]
  }
}
```

テストファイルは `.spec.ts` という命名にしてください。次の内容で `test.spec.ts` ファイルを作成します。

```typescript
test('first test', () => {
    expect(1 + 1).toBe(2);
});
```

これで jest コマンドを使用して、すべてのテストスイートを一度に実行できます。

```sh
$ node_modules/.bin/jest
 PASS  ./test.spec.ts
  ✓ first test (1 ms)

Test Suites: 1 passed, 1 total
Tests:       1 passed, 1 total
Snapshots:   0 total
Time:        0.23 s, estimated 1 s
Ran all test suites.
```

Jest CLI ツールの仕組みや、より高度なテストやテストスイート全体の書き方については [Jest-Dokumentation](https://jestjs.io) を参照してください。

## ユニットテスト

可能な限り、サービスにはユニットテストを行うべきです。サービスの依存関係がシンプルで、適切に分離され、明確に定義されているほど、テストは容易になります。この場合、次のようなシンプルなテストが書けます。

```typescript
export class MyService {
    helloWorld() {
        return 'hello world';
    }
}
```

```typescript
//
import { MyService } from './my-service.ts';

test('hello world', () => {
    const myService = new MyService();
    expect(myService.helloWorld()).toBe('hello world');
});
```

## 統合テスト

ユニットテストが常に書けるとは限らず、ビジネス上重要なコードや挙動を網羅する最も効率的な方法であるとも限りません。特にアーキテクチャが非常に複雑な場合は、エンドツーエンドの統合テストを容易に実行できることが有益です。

依存性注入の章で学んだとおり、依存性注入コンテナは Deepkit の中核です。ここで全てのサービスが構築・実行されます。アプリケーションでは、サービス（プロバイダー）、コントローラー、リスナー、インポートを定義します。統合テストでは、テストケースで全てのサービスを利用可能にする必要は必ずしもなく、通常は重要な箇所をテストできる簡素化したアプリケーションのバージョンを用意したくなります。

```typescript
import { createTestingApp } from '@deepkit/framework';
import { http, HttpRequest } from '@deepkit/http';

test('http controller', async () => {
    class MyController {

        @http.GET()
        hello(@http.query() text: string) {
            return 'hello ' + text;
        }
    }

    const testing = createTestingApp({ controllers: [MyController] });
    await testing.startServer();

    const response = await testing.request(HttpRequest.GET('/').query({text: 'world'}));

    expect(response.getHeader('content-type')).toBe('text/plain; charset=utf-8');
    expect(response.body.toString()).toBe('hello world');
});
```

```typescript
import { createTestingApp } from '@deepkit/framework';

test('service', async () => {
    class MyService {
        helloWorld() {
            return 'hello world';
        }
    }

    const testing = createTestingApp({ providers: [MyService] });

    // 依存性注入コンテナにアクセスして MyService をインスタンス化する
    const myService = testing.app.get(MyService);

    expect(myService.helloWorld()).toBe('hello world');
});
```

アプリケーションを複数のモジュールに分割している場合は、より容易にテストできます。たとえば、`AppCoreModule` を作成しており、いくつかのサービスをテストしたいとします。

```typescript
class Config {
    items: number = 10;
}

export class MyService {
    constructor(protected items: Config['items']) {

    }

    doIt(): boolean {
        // 何かを行う
        return true;
    }
}

export AppCoreModule = new AppModule({}, {
    config: config,
    provides: [MyService]
}, 'core');
```

モジュールは次のように使用します:

```typescript
import { AppCoreModule } from './app-core.ts';

new App({
    imports: [new AppCoreModule]
}).run();
```

そして、アプリケーションサーバー全体を起動せずにテストします。

```typescript
import { createTestingApp } from '@deepkit/framework';
import { AppCoreModule, MyService } from './app-core.ts';

test('service simple', async () => {
    const testing = createTestingApp({ imports: [new AppCoreModule] });

    const myService = testing.app.get(MyService);
    expect(myService.doIt()).toBe(true);
});

test('service simple big', async () => {
    // 特定のテストシナリオ向けにモジュールの設定を変更できます
    const testing = createTestingApp({
        imports: [new AppCoreModule({items: 100})]
    });

    const myService = testing.app.get(MyService);
    expect(myService.doIt()).toBe(true);
});
```