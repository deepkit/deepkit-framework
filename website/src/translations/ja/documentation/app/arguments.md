# 引数とフラグ

コマンドのターミナルでのコマンド引数は、`execute` メソッドや関数の通常の引数に相当します。これらは自動的にコマンドライン引数にマッピングされます。
パラメータをオプションにすると、渡す必要はありません。デフォルト値がある場合も同様に必須ではありません。

型（string、number、union など）に応じて、渡された値は自動的にデシリアライズされ、検証されます。

```typescript
import { cli } from '@deepkit/app';

//関数スタイル
new App().command('test', (name: string) => {
    console.log('Hello', name);
});

//クラス
@cli.controller('test')
class TestCommand {
    async execute(name: string) {
        console.log('Hello', name);
    }
}
```

このコマンドを name パラメータを指定せずに実行すると、エラーが発生します:

```sh
$ ts-node app.ts test
RequiredArgsError: Missing 1 required arg:
name
```

`--help` を使うと、必須引数に関する詳細情報が表示されます:

```sh
$ ts-node app.ts test --help
USAGE
  $ ts-node-script app.ts test NAME
```

name を引数として渡すと、コマンドが実行され、name が正しく渡されます。

```sh
$ ts-node app.ts test "beautiful world"
Hello beautiful world
```

string、number、boolean、文字列リテラル、それらのユニオン、さらにそれらの配列といったあらゆるプリミティブなパラメータ型は、自動的に CLI 引数として扱われ、
自動的に検証およびデシリアライズされます。パラメータの順序が CLI 引数の順序を決定します。パラメータはいくつでも追加できます。

インターフェース、クラス、オブジェクトリテラルのような複雑なオブジェクトが定義されると、それはサービスの依存関係として扱われ、
依存性注入コンテナが解決を試みます。詳細は [依存性注入](dependency-injection.md) の章を参照してください。

## フラグ

フラグは、コマンドに値を渡すもう一つの方法です。多くの場合オプションですが、必須にすることもできます。Type `Flag` で修飾されたパラメータは、`--name value` または `--name=value` で渡せます。

```typescript
import { Flag } from '@deepkit/app';

//関数スタイル
new App().command('test', (id: number & Flag) => {
    console.log('id', name);
});

//クラス
class TestCommand {
    async execute(id: number & Flag) {
        console.log('id', id);
    }
}
```

```sh
$ ts-node app.ts test --help
USAGE
  $ ts-node app.ts test

OPTIONS
  --id=id  (required)
```

ヘルプ表示の「OPTIONS」に、`--id` フラグが必要であることが示されています。このフラグを正しく入力すると、コマンドはその値を受け取ります。

```sh
$ ts-node app.ts test --id 23
id 23

$ ts-node app.ts test --id=23
id 23
```

### ブール型のフラグ

フラグには、特定の挙動を有効化するために値なしのフラグとして使える利点があります。パラメータがオプションの boolean としてマークされている場合、この挙動が有効になります。

```typescript
import { Flag } from '@deepkit/app';

//関数スタイル
new App().command('test', (remove: boolean & Flag = false) => {
    console.log('delete?', remove);
});

//クラス
class TestCommand {
    async execute(remove: boolean & Flag = false) {
        console.log('delete?', remove);
    }
}
```

```sh
$ ts-node app.ts test
delete? false

$ ts-node app.ts test --remove
delete? true
```

### 複数の値を持つフラグ

同じフラグに複数の値を渡すには、フラグを配列としてマークできます。

```typescript
import { Flag } from '@deepkit/app';

//関数スタイル
new App().command('test', (id: number[] & Flag = []) => {
    console.log('ids', id);
});

//クラス
class TestCommand {
    async execute(id: number[] & Flag = []) {
        console.log('ids', id);
    }
}
```

```sh
$ ts-node app.ts test
ids: []

$ ts-node app.ts test --id 12
ids: [12]

$ ts-node app.ts test --id 12 --id 23
ids: [12, 23]
```

### 単一文字フラグ

フラグを 1 文字でも渡せるようにするには、`Flag<{char: 'x'}>` を使用します。

```typescript
import { Flag } from '@deepkit/app';

//関数スタイル
new App().command('test', (output: string & Flag<{char: 'o'}>) => {
    console.log('output: ', output);
});

//クラス
class TestCommand {
    async execute(output: string & Flag<{char: 'o'}>) {
        console.log('output: ', output);
    }
}
```

```sh
$ ts-node app.ts test --help
USAGE
  $ ts-node app.ts test

OPTIONS
  -o, --output=output  (required)


$ ts-node app.ts test --output test.txt
output: test.txt

$ ts-node app.ts test -o test.txt
output: test.txt
```

## オプション/デフォルト

メソッド/関数のシグネチャは、どの引数やフラグがオプションかを定義します。型システム上でパラメータがオプションであれば、ユーザーはそれを指定する必要がありません。

```typescript

//関数スタイル
new App().command('test', (name?: string) => {
    console.log('Hello', name || 'nobody');
});

//クラス
class TestCommand {
    async execute(name?: string) {
        console.log('Hello', name || 'nobody');
    }
}
```

```sh
$ ts-node app.ts test
Hello nobody
```

デフォルト値を持つパラメータについても同様です:

```typescript
//関数スタイル
new App().command('test', (name: string = 'body') => {
    console.log('Hello', name);
});

//クラス
class TestCommand {
    async execute(name: string = 'body') {
        console.log('Hello', name);
    }
}
```

```sh
$ ts-node app.ts test
Hello nobody
```

これはフラグにも同様に適用されます。


## シリアライズ/バリデーション

すべての引数とフラグは、その型に基づいて自動的にデシリアライズおよび検証され、さらに追加の制約を与えることができます。

したがって、数値として定義された引数は、コマンドラインインターフェースがテキスト（つまり文字列）に基づいているにもかかわらず、コントローラー内では常に実数として保証されます。

```typescript
//関数スタイル
new App().command('test', (id: number) => {
    console.log('id', id, typeof id);
});

//クラス
class TestCommand {
    async execute(id: number) {
        console.log('id', id, typeof id);
    }
}
```

```sh
$ ts-node app.ts test 123
id 123 number
```

追加の制約は、`@deepkit/type` の型注釈で定義できます。

```typescript
import { Positive } from '@deepkit/type';
//関数スタイル
new App().command('test', (id: number & Positive) => {
    console.log('id', id, typeof id);
});

//クラス
class TestCommand {
    async execute(id: number & Positive) {
        console.log('id', id, typeof id);
    }
}
```

`id` の型 `Postive` は、正の数のみが許可されることを示します。ここでユーザーが負の数を渡すと、コードはまったく実行されず、エラーメッセージが表示されます。

```sh
$ ts-node app.ts test -123
Validation error in id: Number needs to be positive [positive]
```

このような簡単に行える追加のバリデーションによって、コマンドは誤った入力に対してはるかに堅牢になります。詳細は [バリデーション](../runtime-types/validation.md) の章を参照してください。

## 説明

フラグや引数を説明するには、`@description` コメントデコレーターを使用します。

```typescript
import { Positive } from '@deepkit/type';

class TestCommand {
    async execute(
        /** @description ユーザーの識別子 */
        id: number & Positive,
        /** @description ユーザーを削除しますか？ */
        remove: boolean = false
    ) {
        console.log('id', id, typeof id);
    }
}
```

ヘルプ表示では、この説明がフラグや引数の後に表示されます:

```sh
$ ts-node app.ts test --help
USAGE
  $ ts-node app.ts test ID

ARGUMENTS
  ID  The users identifier

OPTIONS
  --remove  Delete the user?
```