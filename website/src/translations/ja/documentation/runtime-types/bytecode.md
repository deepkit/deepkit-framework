# バイトコード

JavaScript における Deepkit の型情報のエンコードと読み取りの詳細を学ぶために、この章があります。ここでは、型が実際にどのようにバイトコードへ変換され、JavaScript に出力され、実行時に解釈されるかを説明します。

## Typen-Compiler

型コンパイラ（@deepkit/type-compiler）は、TypeScript ファイル内で定義された型を読み取り、バイトコードにコンパイルする役割を担います。このバイトコードには、実行時に型を実行するために必要なものがすべて含まれています。
執筆時点では、型コンパイラはいわゆる TypeScript トランスフォーマーです。このトランスフォーマーは TypeScript コンパイラ自体のプラグインであり、TypeScript の AST（抽象構文木）を別の TypeScript AST に変換します。Deepkit の型コンパイラはこの過程で AST を読み取り、対応するバイトコードを生成し、それを AST に挿入します。

TypeScript 自体はこのプラグイン（トランスフォーマー）を tsconfig.json で設定することを許可していません。TypeScript コンパイラ API を直接使うか、`ts-loader` を備えた Webpack などのビルドシステムを使う必要があります。Deepkit ユーザーがこの不便な方法を避けられるように、Deepkit の型コンパイラは `@deepkit/type-compiler` がインストールされると `node_modules/typescript` に自動的にインストールされます。これにより、ローカルにインストールされた TypeScript（`node_modules/typescript` のもの）へアクセスするすべてのビルドツールで型コンパイラが自動的に有効になります。その結果、tsc、Angular、webpack、ts-node、その他いくつかのツールが Deepkit の型コンパイラと自動的に連携して動作します。

NPM のインストールスクリプトの自動実行が無効で、ローカルにインストールされた TypeScript が変更されない場合は、この処理を必要に応じて手動で実行する必要があります。あるいは、webpack のようなビルドツールで型コンパイラを手動で使用することもできます。上記のインストールセクションを参照してください。

## バイトコードのエンコーディング

バイトコードは仮想マシンのためのコマンド列であり、JavaScript 自体の中に参照と文字列（実際のバイトコード）の配列としてエンコードされます。

```typescript
//TypeScript
type TypeA = string;

//生成された JavaScript
const typeA = ['&'];
```

既存のコマンド自体はそれぞれ 1 バイトのサイズで、`@deepkit/type-spec` の `ReflectionOp` enum として定義されています。執筆時点では、コマンドセットは 81 を超えるコマンドで構成されています。

```typescript
enum ReflectionOp {
    never,
    any,
    unknown,
    void,
    object,

    string,
    number,

    //...さらに多数
}
```

コマンドのシーケンスはメモリ節約のため文字列としてエンコードされます。したがって、型 `string[]` はバイトコードプログラム `[string, array]` として概念化され、バイト列 `[5, 37]` を持ち、次のアルゴリズムでエンコードされます。

```typescript
function encodeOps(ops: ReflectionOp[]): string {
    return ops.map(v => String.fromCharCode(v + 33)).join('');
}
```

それに応じて、5 は `&` 文字になり、37 は `F` 文字になります。合わせて `&F` となり、Javascript では `['&F']` として出力されます。

```typescript
//TypeScript
export type TypeA = string[];

//生成された JavaScript
export const __ΩtypeA = ['&F'];
```

名前の衝突を防ぐため、各型には "_Ω" プレフィックスが付与されます。エクスポートされた型、またはエクスポートされた型で使用される明示的に定義された各型について、JavaScript にバイトコードが出力されます。クラスや関数も、プロパティとして直接バイトコードを受け取ります。

```typescript
//TypeScript
function log(message: string): void {}

//生成された JavaScript
function log(message) {}
log.__type = ['message', 'log', 'P&2!$/"'];
```

## 仮想マシン

実行時には仮想マシン（`@deepkit/type` の Class Processor）が、エンコードされたバイトコードのデコードと実行を担当します。常に [リフレクション API](./reflection.md) で説明されている型オブジェクトを返します。

詳しくは [TypeScript バイトコードインタプリタ / 実行時の型 #47658](https://github.com/microsoft/TypeScript/issues/47658) を参照してください。