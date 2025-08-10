# 反射

若要直接处理类型信息本身，有两种基本变体：类型对象和反射类。类型对象是由 `typeOf<T>()` 返回的常规 JS 对象。反射类将在下文讨论。

函数 `typeOf` 适用于所有类型，包括接口、对象字面量、类、函数和类型别名。它返回一个包含该类型全部信息的类型对象。你可以传入任意类型作为类型参数，包括泛型。

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

类型对象是一个简单的对象字面量，包含一个 `kind` 属性用来指示该类型对象的类型。`kind` 属性是一个数字，其含义取自枚举 `ReflectionKind`。`ReflectionKind` 在 `@deepkit/type` 包中定义如下：

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

  //... 以及更多
}
```

可能返回的类型对象有很多种。最简单的有 `never`、`any`、`unknown`、`void`、`null` 和 `undefined`，它们表示如下：

```typescript
{kind: 0}; //never
{kind: 1}; //any
{kind: 2}; //unknown
{kind: 3}; //void
{kind: 10}; //null
{kind: 11}; //undefined
```

例如，数字 0 是 `ReflectionKind` 枚举的第一个条目，此处为 `never`；数字 1 是第二个条目，此处为 `any`，依此类推。相应地，像 `string`、`number`、`boolean` 这样的原始类型表示如下：

```typescript
typeOf<string>(); //{kind: 5}
typeOf<number>(); //{kind: 6}
typeOf<boolean>(); //{kind: 7}
```

这些较为简单的类型在类型对象上没有更多信息，因为它们是直接作为类型参数传递给 `typeOf` 的。然而，如果通过类型别名传递类型，则可以在类型对象上找到更多信息。

```typescript
type Title = string;

typeOf<Title>(); //{kind: 5, typeName: 'Title'}
```

在此情况下，类型别名 'Title' 的名称也可用。如果类型别名是泛型，所传入的类型也会在类型对象上可用。

```typescript
type Title<T> = T extends true ? string : number;

typeOf<Title<true>>();
{kind: 5, typeName: 'Title', typeArguments: [{kind: 7}]}
```

如果传入的类型是索引访问操作符的结果，则会包含容器和索引类型：

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

接口和对象字面量都以 Reflection.objectLiteral 输出，并在 `types` 数组中包含属性和方法。

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
typeOf<User>(); //返回与上面相同的对象
```

索引签名也在 `types` 数组中。

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
      index: {kind: 5}, //字符串
      type: {kind: 6}, //数字
    }
  ]
}

type BagOfNumbers  = {
    [name: string]: number;
}
typeOf<BagOfNumbers>(); //返回与上面相同的对象
```

类与对象字面量类似，除了 `classType`（它是对类本身的引用）外，也在 `types` 数组下拥有其属性和方法。

```typescript
class User {
  id: number = 0;
  username: string = '';
  login(password: string): void {
     //什么也不做
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

请注意，Reflection.propertySignature 的类型变为了 Reflection.property，而 Reflection.methodSignature 变为了 Reflection.method。由于类上的属性和方法具有附加的属性，这些信息也可以被检索。后者还包括 `visibility`、`abstract` 和 `default`。
类的类型对象仅包含类自身的属性和方法，而不包含父类的。这与接口/对象字面量的类型对象相反，后者会将所有父级的属性签名和方法签名解析到 `types` 中。若要解析父类的属性和方法，可以使用 ReflectionClass 及其 `ReflectionClass.getProperties()`（见下节），或使用 `@deepkit/type` 的 `resolveTypeMembers()`。

类型对象种类繁多。例如，字面量、模板字面量、Promise、枚举、联合、数组、元组等。要了解都有哪些以及可用的信息，建议从 `@deepkit/type` 导入 `Type`。它是一个包含所有可能子类型的 `union`，如 TypeAny、TypeUnknonwn、TypeVoid、TypeString、TypeNumber、TypeObjectLiteral、TypeArray、TypeClass 等。在那里你可以找到精确的结构。

## 类型缓存

当未传递泛型参数时，类型对象会对类型别名、函数和类进行缓存。这意味着调用 `typeOf<MyClass>()` 总是返回相同的对象。

```typescript
type MyType = string;

typeOf<MyType>() === typeOf<MyType>(); //true
```

然而，一旦使用了泛型类型，即便每次传入的类型都相同，也总会创建新对象。这是因为理论上可能存在无限多的组合，这样的缓存将会导致内存泄漏。

```typescript
type MyType<T> = T;

typeOf<MyType<string>>() === typeOf<MyType<string>>();
//false
```

但是，一旦某个类型在递归类型中被多次实例化，它会被缓存。不过，该缓存的持续时间仅限于该类型计算的时刻，之后即不存在。此外，尽管类型对象被缓存了，返回的是新的引用，并不是完全相同的对象。

```typescript
type MyType<T> = T;
type Object = {
   a: MyType<string>;
   b: MyType<string>;
};

typeOf<Object>();
```

在计算 `Object` 期间，`MyType<string>` 会被缓存。因此，`a` 和 `b` 的 PropertySignature 具有来自缓存的相同 `type`，但它们不是同一个 Type 对象。

所有非根类型对象都有一个 parent 属性，通常指向封闭的父级。例如，这对于判断某个类型是否属于联合类型的一部分很有用。

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

“Ref 1” 指向实际的联合类型对象。

对于如上示例所示的已缓存类型对象，`parent` 属性并不总是真正的父级。例如，对于被多次使用的类，尽管 `types` 中的直接类型（TypePropertySignature 和 TypeMethodSignature）指向正确的 TypeClass，但这些签名类型的 `type` 会指向缓存条目的 TypeClass 的签名类型。了解这一点很重要，以免无限地读取父级结构，而只读取直接父级。父级不具备无限精确性的原因是出于性能考虑。

## JIT 缓存

在后续描述的一些函数和特性中，常常基于类型对象。为了高效地实现其中一些，需要为每个类型对象提供一个 JIT（just in time）缓存。这可以通过 `getJitContainer(type)` 提供。该函数返回一个简单对象，可在其上存储任意数据。只要不再持有对该对象的引用，当类型对象本身也不再被引用时，它将由 GC 自动删除。

## 反射类

除了 `typeOf<>()` 函数外，还有各种反射类，它们为类型对象提供了面向对象（OOP）的替代方案。反射类仅适用于类、接口/对象字面量和函数及其直接子类型（属性、方法、参数）。更深层的类型必须再次通过类型对象读取。

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

## 接收类型信息

为了提供对类型进行操作的函数，向用户提供手动传入类型的能力是很有用的。例如，在一个校验函数中，可能希望将目标类型作为第一个类型参数传入，并将要校验的数据作为第一个函数参数。

```typescript
validate<string>(1234);
```

为了让此函数获取到类型 `string`，必须把这一点告知类型编译器。

```typescript
function validate<T>(data: any, type?: ReceiveType<T>): void;
```

带有对第一个类型参数 `T` 的引用的 `ReceiveType` 会向类型编译器发出信号，表示每次调用 `validate` 都应把该类型放在第二个位置（因为 `type` 在第二个位置声明）。随后在运行时读取该信息，使用 `resolveReceiveType` 函数。

```typescript
import { resolveReceiveType, ReceiveType } from '@deepkit/type';

function validate<T>(data: any, type?: ReceiveType<T>): void {
    type = resolveReceiveType(type);
}
```

将结果赋值给同一个变量是有益的，以避免不必要地创建新变量。现在 `type` 中要么存储着一个类型对象，要么会抛出错误，例如未传入类型参数、Deepkit 的类型编译器未正确安装，或未启用类型信息的发出（参见上文安装章节）。