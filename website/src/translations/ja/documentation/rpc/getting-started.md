# はじめに

Deepkit RPC を使用するには、ランタイム型に基づいているため `@deepkit/type` を正しくインストールしておく必要があります。 [ランタイム型のインストール](../runtime-types.md) を参照してください。

これが完了したら、ライブラリを内部で既に使用している `@deepkit/rpc` または Deepkit Framework をインストールできます。

```sh
npm install @deepkit/rpc
```

なお、`@deepkit/rpc` の Controller クラスは TypeScript のデコレーターに基づいており、この機能を使用するには experimentalDecorators を有効にする必要があります。

サーバーとクライアントがそれぞれ独自の package.json を持つ場合は、`@deepkit/rpc` パッケージを両方にインストールする必要があります。

サーバーと TCP で通信するには、クライアントとサーバーの両方に `@deepkit/rpc-tcp` パッケージをインストールする必要があります。

```sh
npm install @deepkit/rpc-tcp
```

WebSocket 通信を行う場合、サーバー側にもこのパッケージが必要です。一方で、ブラウザー内のクライアントは標準の WebSocket を使用します。

クライアントを WebSocket が利用できない環境（例: NodeJS）でも使用する場合は、クライアント側に ws パッケージが必要です。

```sh
npm install ws
```

## 使い方

以下は、WebSocket と @deepkit/rpc の低レベル API に基づく完全に動作するサンプルです。Deepkit Framework を使用する場合、Controller はアプリのモジュール経由で提供され、RpcKernel を手動でインスタンス化する必要はありません。

_ファイル: server.ts_

```typescript
import { rpc, RpcKernel } from '@deepkit/rpc';
import { RpcWebSocketServer } from '@deepkit/rpc-tcp';

@rpc.controller('/main')
export class Controller {
    @rpc.action()
    hello(title: string): string {
        return 'Hello ' + title;
    }
}

const kernel = new RpcKernel();
kernel.registerController(Controller);
const server = new RpcWebSocketServer(kernel, 'localhost:8081');
server.start({
    host: '127.0.0.1',
    port: 8081,
});
console.log('Server started at ws://127.0.0.1:8081');

```

_ファイル: client.ts_

```typescript
import { RpcWebSocketClient } from '@deepkit/rpc';
import type { Controller } from './server';

async function main() {
    const client = new RpcWebSocketClient('ws://127.0.0.1:8081');
    const controller = client.controller<Controller>('/main');

    const result = await controller.hello('World');
    console.log('result', result);

    client.disconnect();
}

main().catch(console.error);

```

## サーバーの Controller

Remote Procedure Call における「Procedure」という用語は、「Action」とも一般的に呼ばれます。Action はクラス内で定義されたメソッドで、`@rpc.action` デコレーターでマークされます。クラス自体は `@rpc.controller` デコレーターで Controller としてマークされ、一意の名前が与えられます。この名前は、クライアントで正しい Controller にアクセスするために参照されます。必要に応じて複数の Controller を定義して登録できます。


```typescript
import { rpc } from '@deepkit/rpc';

@rpc.controller('/main');
class Controller {
    @rpc.action()
    hello(title: string): string {
        return 'Hello ' + title;
    }

    @rpc.action()
    test(): boolean {
        return true;
    }
}
```

クライアントから呼び出せるのは、`@rpc.action()` が付与されたメソッドのみです。

型は明示的に指定しなければならず、型推論は使用できません。これは、シリアライザーがデータをバイナリ（BSON）や JSON に変換して送信するために、型の構造を正確に把握する必要があるためです。

## クライアントの Controller

RPC の一般的な流れでは、クライアントがサーバー上の関数を実行します。しかし Deepkit RPC では、サーバーがクライアント上の関数を実行することも可能です。これを実現するために、クライアント側でも Controller を登録できます。

TODO

## 依存性注入

Deepkit Framework を使用する場合、クラスは依存性注入コンテナによってインスタンス化され、アプリケーション内の他のすべてのプロバイダーに自動的にアクセスできます。

あわせて [依存性注入](dependency-injection.md#) も参照してください。

## RxJS のストリーミング

TODO

## 名目型

クライアントが関数呼び出しのデータを受け取る際、そのデータはまずサーバーでシリアライズされ、クライアントでデシリアライズされます。関数の戻り値の型にクラスが含まれている場合、これらのクラスはクライアント側で再構築されますが、名目上の同一性や関連するメソッドを失います。この問題に対処するには、クラスに一意の ID/名前を付けて名目型として登録してください。この手法は、RPC-API 内で使用されるすべてのクラスに適用するべきです。

クラスを登録するには、`@entity.name('id')` デコレーターを使用します。

```typescript
import { entity } from '@deepkit/type';

@entity.name('user')
class User {
    id!: number;
    firstName!: string;
    lastName!: string;
    get fullName() {
        return this.firstName + ' ' + this.lastName;
    }
}
```

このクラスが関数の結果として使用されると、その同一性が保持されます。

```typescript
const controller = client.controller<Controller>('/main');

const user = await controller.getUser(2);
user instanceof User; // @entity.name が使用されていれば true、そうでなければ false
```