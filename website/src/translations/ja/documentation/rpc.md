# RPC

RPC は Remote Procedure Call（リモートプロシージャコール）の略で、リモートサーバー上の関数をローカル関数のように呼び出せる仕組みです。マッピングに HTTP メソッドと URL を用いる HTTP のクライアント-サーバー通信とは異なり、RPC は関数名でマッピングを行います。送信するデータは通常の関数の引数として渡され、サーバーでの関数呼び出しの結果がクライアントへ返送されます。

RPC の利点は、ヘッダー、URL、クエリ文字列などを扱わないため、クライアント-サーバーの抽象化が軽量であることです。欠点は、RPC 経由でのサーバー上の関数はブラウザから簡単には呼び出せず、しばしば特定のクライアントを必要とすることです。

RPC の重要な特徴のひとつは、クライアントとサーバー間のデータが自動的にシリアライズ/デシリアライズされることです。そのため、型安全な RPC クライアントを実現しやすくなります。いくつかの RPC フレームワークは、特定の形式で型（Parameter の型や Return Value）を提供することをユーザーに強制します。これは gRPC の Protocol Buffers や GraphQL のような DSL、あるいは JavaScript のスキーマビルダーの形を取る場合があります。追加のデータ検証も RPC フレームワークが提供できることがありますが、すべてでサポートされているわけではありません。

Deepkit RPC は TypeScript のコードそのものから Type を抽出するため、コードジェネレーターを使用したり手動で定義したりする必要がありません。Deepkit は Parameter と結果の自動シリアライズ/デシリアライズをサポートします。Validation に追加の制約が定義されると、それらは自動的に検証されます。これにより、RPC による通信は非常に型安全で効率的になります。Deepkit RPC の `rxjs` によるストリーミングのサポートは、この RPC フレームワークをリアルタイム通信に適したツールにします。

RPC の背後にある概念を示すため、次のコードを考えてみましょう:

```typescript
//server.ts
class Controller {
    hello(title: string): string {
        return 'Hello ' + title
    }
}
```

hello のような Method は、サーバー上の Class 内で通常の Function と同様に実装され、リモートクライアントから呼び出すことができます。

```typescript
//client.ts
const client = new RpcClient('localhost');
const controller = client.controller<Controller>();

const result = await controller.hello('World'); // => 'Hello World';
```

RPC は本質的に非同期通信に基づいているため、通信は通常 HTTP を介して行われますが、TCP や WebSocket を介して行うこともできます。これは、TypeScript のすべての関数呼び出しがそれ自体 `Promise` に変換されることを意味します。結果は対応する `await` により非同期に受け取れます。

## アイソモーフィック TypeScript

プロジェクトがクライアント（通常はフロントエンド）とサーバー（バックエンド）の両方で TypeScript を使用している場合、これをアイソモーフィック TypeScript と呼びます。TypeScript の Type に基づく型安全な RPC フレームワークは、このようなプロジェクトに特に有用で、クライアントとサーバーの間で型を共有できます。

これを活用するには、両側で使用される型を専用のファイルまたはパッケージに切り出すとよいでしょう。それぞれの側でインポートすることで、再び組み合わせて利用できます。

```typescript
//shared.ts
export class User {
    id: number;
    username: string;
}

//server.ts
import { User } from './shared';

@rpc.controller('/user')
class UserController  {
    async getUser(id: number): Promise<User> {
        return await datbase.query(User).filter({id}).findOne();
    }
}

//client.ts
import { UserControllerApi } from './shared';
import type { UserController } from './server.ts'
const controller = client.controller<UserController>('/user');
const user = await controller.getUser(2); // => User
```

後方互換性は、通常のローカル API と同様の方法で実現できます。新しい Parameter をオプショナルとしてマークするか、新しい Method を追加します。