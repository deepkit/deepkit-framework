# シリアライズ

シリアライズは、例えばデータ型を転送や保存に適した形式へ変換するプロセスです。デシリアライズはその逆を行うプロセスです。これはロスレスで行われ、データ型情報やデータそのものを失うことなく、シリアライズの対象形式との間で相互に変換できます。

JavaScript におけるシリアライズは、通常 JavaScript のオブジェクトと JSON の間で行われます。JSON がサポートするのは String、Number、Boolean、Objects、Arrays のみです。一方で JavaScript は、BigInt、ArrayBuffer、型付き配列、Date、カスタムクラスのインスタンスなど、他にも多くの型をサポートします。さて、JSON を使って JavaScript のデータをサーバーに送信するには、シリアライズ処理（クライアント側）とデシリアライズ処理（サーバー側）が必要です。逆に、サーバーが JSON としてデータをクライアントに送る場合も同様です。これはロスレスではないため、`JSON.parse` と `JSON.stringify` だけでは不十分であることが多いです。

このシリアライズ処理は、非自明なデータにおいては絶対に必要です。というのも、JSON は日付のような基本型ですら情報を失ってしまうからです。新しい Date は最終的に JSON では文字列としてシリアライズされます:

```typescript
const json = JSON.stringify(new Date);
//'"2022-05-13T20:48:51.025Z"
```

ご覧のとおり、JSON.stringify の結果は JSON の文字列です。これを JSON.parse で再びデシリアライズしても、Date オブジェクトではなく文字列になります。

```typescript
const value = JSON.parse('"2022-05-13T20:48:51.025Z"');
//"2022-05-13T20:48:51.025Z"
```

JSON.parse に Date オブジェクトのデシリアライズを学習させるさまざまな回避策はありますが、エラーが起きやすく、性能もよくありません。このケースや他の多くの型に対して型安全なシリアライズ／デシリアライズを可能にするには、シリアライズ処理が必要です。

利用可能な主要な関数は 4 つあります: `serialize`、`cast`、`deserialize`、`validatedDeserialize`。これらの関数の内部では、デフォルトで `@deepkit/type` のグローバルに利用可能な JSON シリアライザが使用されますが、カスタムのシリアライズターゲットも使用できます。

Deepkit Type はユーザー定義のシリアライズターゲットをサポートしていますが、すでに強力な JSON シリアライズターゲットが付属しており、データを JSON オブジェクトとしてシリアライズし、その後 `JSON.stringify` を用いて正しく安全に JSON に変換できます。`@deepkit/bson` を使えば、BSON もシリアライズターゲットとして使用できます。カスタムのシリアライズターゲット（例えばデータベースドライバ向け）を作成する方法は、カスタムシリアライザのセクションで学べます。

なお、シリアライザも互換性のためにデータを検証しますが、これらの検証は [検証](validation.md) にある検証とは異なります。`cast` 関数だけは、デシリアライズが成功した後に [検証](validation.md) 章にある完全な検証プロセスも呼び出し、データが不正な場合はエラーをスローします。

代替として、デシリアライズ後の検証に `validatedDeserialize` を使用することもできます。別の方法としては、`deserialize` 関数でデシリアライズしたデータに対して `validate` または `validates` 関数を手動で呼び出すこともできます。詳しくは [検証](validation.md) を参照してください。

シリアライズと検証のすべての関数は、エラー時に `@deepkit/type` の `ValidationError` をスローします。

## キャスト

`cast` 関数は、最初の型引数として TypeScript の型を、2 番目の引数としてキャストするデータを受け取ります。データは指定された型にキャストされ、成功すればそのデータが返されます。データが指定された型と互換性がなく自動的に変換できない場合は、`ValidationError` がスローされます。

```typescript
import { cast } from '@deepkit/type';

cast<string>(123); //'123'
cast<number>('123'); //123
cast<number>('asdasd'); // ValidationError をスロー

cast<string | number>(123); //123
```

```typescript
class MyModel {
    id: number = 0;
    created: Date = new Date;

    constructor(public name: string) {
    }
}

const myModel = cast<MyModel>({
    id: 5,
    created: 'Sat Oct 13 2018 14:17:35 GMT+0200',
    name: 'Peter',
});
```

`deserialize` 関数は `cast` に似ていますが、データが指定された型と互換性がない場合でもエラーをスローしません。代わりに、可能な限りデータを変換し、その結果を返します。データが指定された型と互換性がない場合は、そのまま返されます。

## シリアライズ

```typescript
import { serialize } from '@deepkit/type';

class MyModel {
    id: number = 0;
    created: Date = new Date;

    constructor(public name: string) {
    }
}

const model = new MyModel('Peter');

const jsonObject = serialize<MyModel>(model);
//{
//  id: 0,
//  created: '2021-06-10T15:07:24.292Z',
//  name: 'Peter'
//}
const json = JSON.stringify(jsonObject);
```

`serialize` 関数は、渡されたデータをデフォルトで JSON シリアライザにより JSON オブジェクト、つまり String、Number、Boolean、Object、または Array に変換します。その結果は `JSON.stringify` を使って安全に JSON に変換できます。

## デシリアライズ

`deserialize` 関数は、渡されたデータをデフォルトで JSON シリアライザにより、指定された型に対応するものへと変換します。JSON シリアライザは JSON オブジェクト、すなわち string、number、boolean、object、または array を想定します。これは通常 `JSON.parse` の呼び出しによって得られます。

```typescript
import { deserialize } from '@deepkit/type';

class MyModel {
    id: number = 0;
    created: Date = new Date;

    constructor(public name: string) {
    }
}

const myModel = deserialize<MyModel>({
    id: 5,
    created: 'Sat Oct 13 2018 14:17:35 GMT+0200',
    name: 'Peter',
});

//JSON から
const json = '{"id": 5, "created": "Sat Oct 13 2018 14:17:35 GMT+0200", "name": "Peter"}';
const myModel = deserialize<MyModel>(JSON.parse(json));
```

正しいデータ型がすでに渡されている場合（例えば `created` には Date オブジェクト）、そのまま使用されます。

クラスだけでなく、任意の TypeScript の型を最初の型引数として指定できます。したがって、プリミティブや非常に複雑な型でも渡せます:

```typescript
deserialize<Date>('Sat Oct 13 2018 14:17:35 GMT+0200');
deserialize<string | number>(23);
```

<a name="loosely-convertion"></a>
### 緩やかな型変換

デシリアライズの過程で緩やかな型変換が実装されています。これは、String 型に対して String や Number を、String 型に対して Number を受け入れて自動的に変換できることを意味します。例えば、URL 経由でデータを受け取りデシリアライザに渡す場合に便利です。URL は常に文字列なので、Deepkit Type は Number と Boolean の型解決も試みます。

```typescript
deserialize<boolean>('false')); //false
deserialize<boolean>('0')); //false
deserialize<boolean>('1')); //true

deserialize<number>('1')); //1

deserialize<string>(1)); //'1'
```

JSON シリアライザには、次の緩やかな型変換が組み込まれています:

* *number|bigint*: Number あるいは Bigint は String、Number、BigInt を受け入れます。変換が必要な場合は `parseFloat` または `BigInt(x)` が使われます。
* *boolean*: Boolean は Number と String を受け入れます。0、'0'、'false' は `false` と解釈されます。1、'1'、'true' は `true` と解釈されます。
* *string*: String は Number、String、Boolean など多くを受け入れます。文字列以外の値は自動的に `String(x)` で変換されます。

緩やかな変換は無効化することもできます:

```typescript
const result = deserialize(data, {loosely: false});
```

無効なデータの場合、変換は試みられず、代わりにエラーがスローされます。