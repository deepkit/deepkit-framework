# リフレクション

型情報自体を直接扱うには、基本的に2つの方式があります: Type オブジェクトと Reflection クラス。Type オブジェクトは `typeOf<T>()` が返す通常の JS オブジェクトです。Reflection クラスについては以下で説明します。

`typeOf` 関数は、Interface、オブジェクトリテラル、Class、Function、型エイリアスを含むすべての型で動作します。型に関するすべての情報を含む Type オブジェクトを返します。ジェネリックを含め、任意の型を型引数として渡すことができます。

```typescript
import { typeOf } from '@deepkit/type';

typeOf<string>(); //{kind: 5}
typeOf<number>(); //{kind: 6}

typeOf<{id: number}>(); //{kind: 4, types: [{kind: 6, name: 'id'}]}

class User {
    id: number
}

typeOf<User>(); //{kind: 4, types: [...]}

function test(id: number): string {}

typeOf<typeof test>(); //{kind: 12, parameters: [...], return: {kind: 5}}
```

Type オブジェクトは、Type オブジェクトの型を示す `kind` プロパティを持つ単純なオブジェクトリテラルです。`kind` プロパティは数値で、enum `ReflectionKind` の値に対応します。`ReflectionKind` は `@deepkit/type` パッケージで次のように定義されています:

```typescript
enum ReflectionKind {
  never,    //0
  any,     //1
  unknown, //2
  void,    //3
  object,  //4
  string,  //5
  number,  //6
  boolean, //7
  symbol,  //8
  bigint,  //9
  null,    //10
  undefined, //11

  //... さらに多数
}
```

返される可能性のある Type オブジェクトはいくつかあります。最も単純なものは `never`, `any`, `unknown`, `void, null,` および `undefined` で、次のように表現されます:

```typescript
{kind: 0}; //never
{kind: 1}; //any
{kind: 2}; //unknown
{kind: 3}; //void
{kind: 10}; //null
{kind: 11}; //undefined
```

たとえば、数値 0 は `ReflectionKind` enum の最初のエントリ、つまり `never` を表し、数値 1 は 2 番目のエントリ、つまり `any` を表す、といった具合です。これに応じて、`string`、`number`、`boolean` のようなプリミティブ型は次のように表現されます:

```typescript
typeOf<string>(); //{kind: 5}
typeOf<number>(); //{kind: 6}
typeOf<boolean>(); //{kind: 7}
```

これらの比較的単純な型は、`typeOf` に直接型引数として渡されているため、Type オブジェクトにはそれ以上の情報はありません。しかし、型エイリアス経由で型が渡される場合、Type オブジェクトには追加情報が含まれます。

```typescript
type Title = string;

typeOf<Title>(); //{kind: 5, typeName: 'Title'}
```

この場合、型エイリアス名 'Title' も取得できます。型エイリアスがジェネリックの場合、渡された型も Type オブジェクトに保持されます。

```typescript
type Title<T> = T extends true ? string : number;

typeOf<Title<true>>();
{kind: 5, typeName: 'Title', typeArguments: [{kind: 7}]}
```

渡された型がインデックスアクセス演算子の結果である場合、コンテナとインデックスタイプも保持されます:

```typescript
interface User {
  id: number;
  username: string;
}

typeOf<User['username']>();
{kind: 5, indexAccessOrigin: {
    container: {kind: Reflection.objectLiteral, types: [...]},
    Index: {kind: Reflection.literal, literal: 'username'}
}}
```

Interface とオブジェクトリテラルはどちらも Reflection.objectLiteral として出力され、`types` 配列に Property と Method を含みます。

```typescript
interface User {
  id: number;
  username: string;
  login(password: string): void;
}

typeOf<User>();
{
  kind: Reflection.objectLiteral,
  types: [
    {kind: Reflection.propertySignature, name: 'id', type: {kind: 6}},
    {kind: Reflection.propertySignature, name: 'username',
     type: {kind: 5}},
    {kind: Reflection.methodSignature, name: 'login', parameters: [
      {kind: Reflection.parameter, name: 'password', type: {kind: 5}}
    ], return: {kind: 3}},
  ]
}

type User  = {
  id: number;
  username: string;
  login(password: string): void;
}
typeOf<User>(); //上と同じオブジェクトを返します
```

インデックスシグネチャも `types` 配列に含まれます。

```typescript
interface BagOfNumbers {
    [name: string]: number;
}


typeOf<BagOfNumbers>;
{
  kind: Reflection.objectLiteral,
  types: [
    {
      kind: Reflection.indexSignature,
      index: {kind: 5}, //string
      type: {kind: 6}, //number
    }
  ]
}

type BagOfNumbers  = {
    [name: string]: number;
}
typeOf<BagOfNumbers>(); //上と同じオブジェクトを返します
```

Class はオブジェクトリテラルと似ており、`classType`（Class 自体への参照）に加えて、`types` 配列の下に Property と Method を持ちます。

```typescript
class User {
  id: number = 0;
  username: string = '';
  login(password: string): void {
     //何もしない
  }
}

typeOf<User>();
{
  kind: Reflection.class,
  classType: User,
  types: [
    {kind: Reflection.property, name: 'id', type: {kind: 6}},
    {kind: Reflection.property, name: 'username',
     type: {kind: 5}},
    {kind: Reflection.method, name: 'login', parameters: [
      {kind: Reflection.parameter, name: 'password', type: {kind: 5}}
    ], return: {kind: 3}},
  ]
}
```

Reflection.propertySignature の種別が Reflection.property に、Reflection.methodSignature が Reflection.method に変わっていることに注意してください。Class 上の Property と Method には追加の属性があるため、この情報も取得できます。後者には `visibility`、`abstract`、`default` などが含まれます。
Class の Type オブジェクトには、その Class 自身の Property と Method のみが含まれ、スーパークラスのものは含まれません。これは、インターフェイスやオブジェクトリテラルの Type オブジェクトとは対照的で、そちらではすべての親の PropertySignature と MethodSignature が解決されて `types` に含まれます。スーパークラスの Property と Method を解決するには、ReflectionClass とその `ReflectionClass.getProperties()`（後続のセクション参照）または `@deepkit/type` の `resolveTypeMembers()` を使用できます。

Type オブジェクトには非常に多くの種類があります。たとえば、literal、テンプレートリテラル、promise、enum、union、array、tuple などです。どれが存在し、どの情報が利用できるかを知るには、`@deepkit/type` から `Type` を import することをお勧めします。これは TypeAny、TypeUnknonwn、TypeVoid、TypeString、TypeNumber、TypeObjectLiteral、TypeArray、TypeClass など、すべての可能なサブタイプを含む `union` です。そこに正確な構造が記されています。

## Type キャッシュ

ジェネリック引数が渡されない限り、型エイリアス、Function、Class の Type オブジェクトはキャッシュされます。つまり、`typeOf<MyClass>()` の呼び出しは常に同じオブジェクトを返します。

```typescript
type MyType = string;

typeOf<MyType>() === typeOf<MyType>(); //true
```

しかし、ジェネリック型が使用されると、渡される型が常に同じであっても、常に新しいオブジェクトが作成されます。これは、理論上無限の組み合わせが可能であり、そのようなキャッシュは事実上メモリリークになるためです。

```typescript
type MyType<T> = T;

typeOf<MyType<string>>() === typeOf<MyType<string>>();
//false
```

ただし、再帰的な型の中で同じ型が複数回インスタンス化される場合、その間はキャッシュされます。ただし、そのキャッシュの存続期間は型が計算されている間に限られ、その後は存在しません。また、Type オブジェクト自体はキャッシュされますが、新しい参照が返され、全く同一のオブジェクトではありません。

```typescript
type MyType<T> = T;
type Object = {
   a: MyType<string>;
   b: MyType<string>;
};

typeOf<Object>();
```

`Object` が計算されている間、`MyType<string>` はキャッシュされます。したがって `a` と `b` の PropertySignature はキャッシュから同じ `type` を持ちますが、同一の Type オブジェクトではありません。

ルート以外のすべての Type オブジェクトには parent プロパティがあり、通常は外側の親を指します。これは、たとえばある Type が union の一部かどうかを判断するのに役立ちます。

```typescript
type ID = string | number;

typeOf<ID>();
*Ref 1* {
  kind: ReflectionKind.union,
  types: [
    {kind: ReflectionKind.string, parent: *Ref 1* } }
    {kind: ReflectionKind.number, parent: *Ref 1* }
  ]
}
```

'Ref 1' は実際の union の Type オブジェクトを指します。

上記のようにキャッシュされた Type オブジェクトでは、`parent` プロパティが常に本来の親を指しているとは限りません。たとえば、ある Class が複数回使用される場合、`types` 内の直近の型（TypePropertySignature および TypeMethodSignature）は正しい TypeClass を指しますが、これらのシグネチャ型の `type` はキャッシュされたエントリの TypeClass のシグネチャ型を指します。親構造を無限に辿らず直近の親のみを読むために、これは重要な知識です。parent が無限の精度を持たないのは、パフォーマンス上の理由によるものです。

## JIT キャッシュ

以降では、しばしば Type オブジェクトに基づく関数や機能について説明します。その一部を高性能に実装するため、Type オブジェクトごとの JIT（just in time）キャッシュが必要になります。これは `getJitContainer(type)` を介して提供できます。この関数は任意のデータを保存できる単純なオブジェクトを返します。そのオブジェクトへの参照が保持されない限り、Type オブジェクト自体が参照されなくなった時点で GC によって自動的に削除されます。

## Reflection クラス

`typeOf<>()` 関数に加えて、Type オブジェクトに対する OOP 代替を提供するさまざまなリフレクション用クラスがあります。これらのリフレクション用クラスは Class、インターフェイス/オブジェクトリテラル、および Function とその直接のサブタイプ（Properties, Methods, Parameters）に対してのみ利用できます。より深い型は、再び Type オブジェクトで読み取る必要があります。

```typescript
import { ReflectionClass } from '@deepkit/type';

interface User {
    id: number;
    username: string;
}


const reflection = ReflectionClass.from<User>();

reflection.getProperties(); //[ReflectionProperty, ReflectionProperty]
reflection.getProperty('id'); //ReflectionProperty

reflection.getProperty('id').name; //'id'
reflection.getProperty('id').type; //{kind: ReflectionKind.number}
reflection.getProperty('id').isOptional(); //false
```

## 型情報の受け取り

型に対して動作する関数を提供するために、ユーザーに型を手動で渡してもらえるようにするのが有用な場合があります。たとえばバリデーション関数では、要求する型を最初の型引数として、検証対象のデータを最初の関数引数として渡せるようにすると便利です。

```typescript
validate<string>(1234);
```

この関数が `string` 型を取得できるようにするには、そのことを型コンパイラに伝える必要があります。

```typescript
function validate<T>(data: any, type?: ReceiveType<T>): void;
```

最初の型引数 `T` への参照を持つ `ReceiveType` は、`validate` の各呼び出しで（`type` が第2引数として宣言されているため）その型を2番目の位置に配置するよう、型コンパイラに指示します。実行時にその情報を読み出すには、`resolveReceiveType` 関数を使用します。

```typescript
import { resolveReceiveType, ReceiveType } from '@deepkit/type';

function validate<T>(data: any, type?: ReceiveType<T>): void {
    type = resolveReceiveType(type);
}
```

不要に新しい変数を作らないよう、結果を同じ変数に代入するのが有用です。`type` には、型引数が渡されなかった、Deepkit の型コンパイラが正しくインストールされていない、もしくは型情報の出力が有効化されていない（上記のインストールのセクションを参照）といった場合に、Type オブジェクトが格納されるか、あるいは Error がスローされます。