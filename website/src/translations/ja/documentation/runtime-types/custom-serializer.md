# カスタムシリアライザ

デフォルトでは、`@deepkit/type` には JSON シリアライザと TypeScript の型検証が付属しています。これを拡張してシリアライズ機能を追加・削除したり、検証の方法を変更することができます。検証はシリアライザとも連動しています。

## 新しいシリアライザ

シリアライザは、シリアライザ テンプレートが登録された `Serializer` Class の単なるインスタンスです。シリアライザ テンプレートは、JIT シリアライザ処理のための JavaScript コードを生成する小さな Function です。各型（String、Number、Boolean など）ごとに、データ変換や検証のためのコードを返す専用のシリアライザ テンプレートが用意されます。このコードは、ユーザーが使用している JavaScript エンジンと互換である必要があります。

コンパイラ テンプレート関数の実行時にのみ、完全な型情報に（もしくはそうあるべきように）フルアクセスできます。型を変換するために必要な情報をすべて直接 JavaScript コードに埋め込むことで、高度に最適化されたコード（JIT 最適化コードとも呼ばれます）を得る、というのが狙いです。

次の例では空のシリアライザを作成します。

```typescript
import { EmptySerializer } from '@deepkit/type';

class User {
    name: string = '';
    created: Date = new Date;
}

const mySerializer = new EmptySerializer('mySerializer');

const user = deserialize<User>({ name: 'Peter', created: 0 }, undefined, mySerializer);
console.log(user);
```

```sh
$ ts-node app.ts
User { name: 'Peter', created: 0 }
```

ご覧の通り、何も変換されていません（`created` は依然として数値ですが、`Date` として定義しています）。これを変更するため、Date 型のデシリアライズ用シリアライザ テンプレートを追加します。

```typescript
mySerializer.deserializeRegistry.registerClass(Date, (type, state) => {
    state.addSetter(`new Date(${state.accessor})`);
});

const user = deserialize<User>({ name: 'Peter', created: 0 }, undefined, mySerializer);
console.log(user);
```

```sh
$ ts-node app.ts
User { name: 'Peter', created: 2021-06-10T19:34:27.301Z }
```

これでシリアライザは値を Date オブジェクトに変換します。

シリアライズでも同様にするため、別のシリアライズ用テンプレートを登録します。

```typescript
mySerializer.serializeRegistry.registerClass(Date, (type, state) => {
    state.addSetter(`${state.accessor}.toJSON()`);
});

const user1 = new User();
user1.name = 'Peter';
user1.created = new Date('2021-06-10T19:34:27.301Z');
console.log(serialize(user1, undefined, mySerializer));
```

```sh
{ name: 'Peter', created: '2021-06-10T19:34:27.301Z' }
```

新しいシリアライザは、シリアライズ処理で Date オブジェクトの日付を文字列に正しく変換します。

## 例

さらに多くの例については、Deepkit Type に含まれている [JSON シリアライザ](https://github.com/deepkit/deepkit-framework/blob/master/packages/type/src/serializer.ts#L1688) のコードを参照してください。

## 既存のシリアライザの拡張

既存のシリアライザを拡張したい場合は、Class 継承を使って実現できます。これは、シリアライザが constructor でテンプレートを登録するように作られているため機能します。

```typescript
class MySerializer extends Serializer {
    constructor(name: string = 'mySerializer') {
        super(name);
        this.registerTemplates();
    }

    protected registerTemplates() {
        this.deserializeRegistry.register(ReflectionKind.string, (type, state) => {
            state.addSetter(`String(${state.accessor})`);
        });

        this.deserializeRegistry.registerClass(Date, (type, state) => {
            state.addSetter(`new Date(${state.accessor})`);
        });

        this.serializeRegistry.registerClass(Date, (type, state) => {
            state.addSetter(`${state.accessor}.toJSON()`);
        });
    }
}
const mySerializer = new MySerializer();
```