# 外部の型

## 外部のクラス

TypeScript はデフォルトでは型情報を含まないため、他のパッケージからインポートされた型/クラス（@deepkit/type-compiler を使用していないもの）には型情報がありません。

外部クラスに型を注釈付けするには `annotateClass` を使用し、インポートしたクラスがどこかで使用される前に、この関数がアプリケーションのブートストラップ段階で実行されるようにしてください。

```typescript
import { MyExternalClass } from 'external-package';
import { annotateClass } from '@deepkit/type';

interface AnnotatedClass {
    id: number;
    title: string;
}

annotateClass<AnnotatedClass>(MyExternalClass);

//MyExternalClass のすべての使用箇所は、現在 AnnotatedClass の型を返します
serialize<MyExternalClass>({...});

//MyExternalClass は他の型でも使用できるようになりました
interface User {
    id: number;
    clazz: MyExternalClass;
}
```

これで `MyExternalClass` はシリアライズ関数やリフレクション API で使用できます。

次の例はジェネリック クラスに注釈を付ける方法を示します:

```typescript
import { MyExternalClass } from 'external-package';
import { annotateClass } from '@deepkit/type';

class AnnotatedClass<T> {
    id!: T;
}

annotateClass(ExternalClass, AnnotatedClass);
```

## import type

`import type` 構文は、実際の JavaScript コードをインポートせず、型チェックのためだけに使用できるようにするために TypeScript によって設計されています。これは、例えば実行時には存在せずコンパイル時にしか利用できないパッケージの型を使いたい場合や、実行時にそのパッケージを実際に読み込みたくない場合に有用です。

Deepkit は `import type` の思想を尊重し、実行時コードを一切生成しません。つまり、`import type` を使用した場合、実行時には型情報は利用できないということです。