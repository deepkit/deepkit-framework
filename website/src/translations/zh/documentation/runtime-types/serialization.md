# 序列化

序列化是将数据类型转换为适合传输或存储等用途的格式的过程。反序列化则是其逆过程。这个过程是无损的，意味着数据在与序列化目标之间来回转换时不会丢失数据类型信息或数据本身。

在 JavaScript 中，序列化通常发生在 JavaScript 对象与 JSON 之间。JSON 仅支持 String、Number、Boolean、Object 和 Array。而 JavaScript 则支持许多其他类型，如 BigInt、ArrayBuffer、typed arrays、Date、自定义类实例等。要使用 JSON 将 JavaScript 数据传输到服务器，你需要一个序列化过程（在客户端）以及一个反序列化过程（在服务器端）；反之亦然，如果服务器将数据以 JSON 发送给客户端。仅使用 `JSON.parse` 和 `JSON.stringify` 往往不足以实现这一点，因为它不是无损的。

对于非平凡的数据，这种序列化过程是绝对必要的，因为 JSON 即使对于诸如日期这样的基本类型也会丢失信息。一个新的 Date 最终在 JSON 中会被序列化为字符串：

```typescript
const json = JSON.stringify(new Date);
//'"2022-05-13T20:48:51.025Z"
```

如你所见，JSON.stringify 的结果是一个 JSON 字符串。如果再用 JSON.parse 进行反序列化，你得到的不会是一个 date 对象，而是一个字符串。

```typescript
const value = JSON.parse('"2022-05-13T20:48:51.025Z"');
//"2022-05-13T20:48:51.025Z"
```

尽管有各种变通方法可以让 JSON.parse 反序列化 Date 对象，但它们容易出错且性能较差。为了在此场景以及许多其他类型上实现类型安全的序列化和反序列化，就需要一个序列化过程。

可用的主要函数有四个：`serialize`、`cast`、`deserialize` 和 `validatedDeserialize`。在这些函数的底层，默认使用的是来自 `@deepkit/type` 的全局可用 JSON 序列化器，但也可以使用自定义的序列化目标。

Deepkit Type 支持用户自定义序列化目标，但已经内置了一个强大的 JSON 序列化目标，能够将数据序列化为 JSON 对象，并可通过 JSON.stringify 正确且安全地转换为 JSON。配合 `@deepkit/bson`，还可以使用 BSON 作为序列化目标。如何创建自定义的序列化目标（例如用于数据库驱动），可在“自定义序列化器”章节中学习。

请注意，虽然序列化器也会对数据的兼容性进行校验，但这些校验与[验证](validation.md)中的验证不同。只有 `cast` 函数在成功反序列化后还会调用[验证](validation.md)章节中的完整验证流程，并在数据无效时抛出错误。

或者，也可以使用 `validatedDeserialize` 在反序列化后进行验证。另一个选择是对来自 `deserialize` 函数的反序列化数据手动调用 `validate` 或 `validates` 函数，详见[验证](validation.md)。

序列化与验证中的所有函数在出错时都会抛出来自 `@deepkit/type` 的 `ValidationError`。

## Cast

`cast` 函数的第一个类型参数是一个 TypeScript 类型，第二个参数是要转换的数据。数据会被转换为给定类型，若成功则返回该数据。如果数据与给定类型不兼容且无法自动转换，则会抛出 `ValidationError`。

```typescript
import { cast } from '@deepkit/type';

cast<string>(123); //'123'
cast<number>('123'); //123
cast<number>('asdasd'); // 抛出 ValidationError

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

`deserialize` 函数与 `cast` 类似，但当数据与给定类型不兼容时不会抛出错误。取而代之的是，数据会尽可能被转换并返回结果。如果数据与给定类型不兼容，则按原样返回该数据。

## 序列化

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

`serialize` 函数默认使用 JSON 序列化器将传入数据转换为 JSON 对象，即：String、Number、Boolean、Object 或 Array。其结果随后可以安全地使用 `JSON.stringify` 转换为 JSON。

## 反序列化

`deserialize` 函数默认使用 JSON 序列化器将传入数据转换为相应的指定类型。JSON 序列化器期望的是一个 JSON 对象，即：string、number、boolean、object 或 array。这通常来自一次 `JSON.parse` 调用。

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

//来自 JSON
const json = '{"id": 5, "created": "Sat Oct 13 2018 14:17:35 GMT+0200", "name": "Peter"}';
const myModel = deserialize<MyModel>(JSON.parse(json));
```

如果已经传入了正确的数据类型（例如 `created` 为 Date 对象），则会直接按原样使用。

不仅可以指定类，任何 TypeScript 类型都可以作为第一个类型参数。因此即使是原始类型或非常复杂的类型也都可以传入：

```typescript
deserialize<Date>('Sat Oct 13 2018 14:17:35 GMT+0200');
deserialize<string | number>(23);
```

<a name="loosely-convertion"></a>
### 宽松类型转换

在反序列化过程中实现了宽松类型转换。这意味着 String 与 Number 可用于 String 类型，或者 Number 可用于 String 类型时会被自动接受并转换。这在通过 URL 接收数据并传递给反序列化器时非常有用。由于 URL 始终是字符串，Deepkit Type 仍会尝试解析 Number 和 Boolean 的类型。

```typescript
deserialize<boolean>('false')); //false
deserialize<boolean>('0')); //false
deserialize<boolean>('1')); //true

deserialize<number>('1')); //1

deserialize<string>(1)); //'1'
```

JSON 序列化器内置了如下宽松类型转换：

* *number|bigint*：Number 或 Bigint 接受 String、Number 和 BigInt。若需要转换，将使用 `parseFloat` 或 `BigInt(x)`。
* *boolean*：Boolean 接受 Number 和 String。0、'0'、'false' 会被解释为 `false`。1、'1'、'true' 会被解释为 `true`。
* *string*：String 接受 Number、String、Boolean 等多种类型。所有非字符串值都会通过 `String(x)` 自动转换。

也可以关闭宽松转换：

```typescript
const result = deserialize(data, {loosely: false});
```

在数据无效的情况下，将不会尝试进行转换，而是直接抛出错误信息。