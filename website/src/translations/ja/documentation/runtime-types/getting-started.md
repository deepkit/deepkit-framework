# はじめに

Deepkit のランタイム型システムをインストールするには、Deepkit Type Compiler と Deepkit Type パッケージ本体という 2 つのパッケージが必要です。Type Compiler は、TypeScript の型からランタイム型情報を生成する TypeScript のトランスフォーマーです。Type パッケージには、ランタイム仮想マシンや型アノテーションに加えて、型を扱うための多くの便利な関数が含まれます。

## インストール 

```sh
npm install --save @deepkit/type
npm install --save-dev @deepkit/type-compiler typescript ts-node
```

ランタイム型情報はデフォルトでは生成されません。有効化するには、`tsconfig.json` ファイルで `"reflection": true` を設定する必要があります。

デコレーターを使用する場合は、`tsconfig.json` で `"experimentalDecorators": true` を有効にする必要があります。これは `@deepkit/type` を使うために厳密には必須ではありませんが、他の Deepkit ライブラリや Deepkit Framework の特定の機能では必要です。

_ファイル: tsconfig.json_

```json
{
  "compilerOptions": {
    "module": "CommonJS",
    "target": "es6",
    "moduleResolution": "node",
    "experimentalDecorators": true
  },
  "reflection": true
}
```

ランタイム型情報を使った最初のコードを書いてみましょう:

_ファイル: app.ts_

```typescript
import { cast, MinLength, ReflectionClass } from '@deepkit/type';

interface User {
    username: string & MinLength<3>;
    birthDate?: Date;
}

const user = cast<User>({
    username: 'Peter',
    birthDate: '2010-10-10T00:00:00Z'
});
console.log(user);

const reflection = ReflectionClass.from<User>();
console.log(reflection.getProperty('username').type);
```

そして `ts-node` で実行します:

```sh
./node_modules/.bin/ts-node app.ts
```

## インタラクティブな例

こちらに CodeSandbox の例があります: https://codesandbox.io/p/sandbox/deepkit-runtime-types-fjmc2f?file=index.ts

## 型コンパイラ

TypeScript 自体は、`tsconfig.json` を通じて型コンパイラを構成することを許可していません。そのため、TypeScript Compiler API を直接使用するか、_ts-loader_ を備えた Webpack のようなビルドシステムを使う必要があります。Deepkit の利用者がこの不便さを回避できるよう、`@deepkit/type-compiler` をインストールすると、Deepkit の型コンパイラは自動的に `node_modules/typescript` に自身をインストールします（これは NPM のインストールフックによって行われます）。
これにより、ローカルにインストールされた TypeScript（`node_modules/typescript` 内のもの）にアクセスするすべてのビルドツールで、型コンパイラが自動的に有効になります。これによって、_tsc_、Angular、webpack、_ts-node_ などのツールが、Deepkit の型コンパイラと自動的に連携して動作します。

型コンパイラが自動的に正しくインストールされなかった場合（たとえば NPM のインストールフックが無効化されている場合）、次のコマンドで手動インストールできます:

```sh
node_modules/.bin/deepkit-type-install
```

ローカルの TypeScript のバージョンが更新された場合（たとえば、package.json の typescript のバージョンが変更されて `npm install` を実行した場合など）は、`deepkit-type-install` を実行する必要がある点に注意してください。

## Webpack

webpack ビルドで型コンパイラを使用したい場合は、`ts-loader` パッケージ（またはトランスフォーマー登録をサポートする他の TypeScript ローダー）で設定できます。

_ファイル: webpack.config.js_

```javascript
const typeCompiler = require('@deepkit/type-compiler');

module.exports = {
  entry: './app.ts',
  module: {
    rules: [
      {
        test: /\.tsx?$/,
          use: {
            loader: 'ts-loader',
            options: {
              // これは @deepkit/type の型コンパイラを有効にします
              getCustomTransformers: (program, getProgram) => ({
                before: [typeCompiler.transformer],
                afterDeclarations: [typeCompiler.declarationTransformer],
              }),
            }
          },
          exclude: /node_modules/,
       },
    ],
  },
}
```