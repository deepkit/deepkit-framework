# 리플렉션

Type 정보 자체를 직접 다루기 위해서는 두 가지 기본 방식이 있습니다: Type objects와 Reflection classes. Type objects는 `typeOf<T>()`가 반환하는 일반 JS 객체입니다. Reflection classes는 아래에서 설명합니다.


`typeOf` Function은 Interface, object literal, class, function, type alias를 포함한 모든 타입에서 작동합니다. 이 Function은 타입에 대한 모든 정보를 담고 있는 type object를 반환합니다. generics를 포함해 어떤 타입이든 type argument로 전달할 수 있습니다.

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

type object는 해당 type object의 타입을 나타내는 `kind` Property를 포함하는 단순한 object literal입니다. `kind` Property는 숫자이며 `ReflectionKind` enum에서 그 의미를 얻습니다. `ReflectionKind`는 `@deepkit/type` 패키지에 다음과 같이 정의되어 있습니다:

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

  //... and even more
}
```

반환될 수 있는 type object는 여러 가지가 있습니다. 가장 단순한 것들은 `never`, `any`, `unknown`, `void, null,` 그리고 `undefined`이며, 다음과 같이 표현됩니다:

```typescript
{kind: 0}; //never
{kind: 1}; //any
{kind: 2}; //unknown
{kind: 3}; //void
{kind: 10}; //null
{kind: 11}; //undefined
```

예를 들어 숫자 0은 `ReflectionKind` enum의 첫 번째 항목(이 경우 `never`)이고, 숫자 1은 두 번째 항목(여기서는 `any`)이며, 이런 식입니다. 이에 따라 `string`, `number`, `boolean`과 같은 primitive type은 다음과 같이 표현됩니다:

```typescript
typeOf<string>(); //{kind: 5}
typeOf<number>(); //{kind: 6}
typeOf<boolean>(); //{kind: 7}
```

이러한 비교적 단순한 타입은 `typeOf`에 직접 type argument로 전달되었기 때문에 type object에 추가 정보가 없습니다. 그러나 type alias를 통해 타입이 전달된 경우에는 type object에 추가 정보를 찾을 수 있습니다.

```typescript
type Title = string;

typeOf<Title>(); //{kind: 5, typeName: 'Title'}
```

이 경우 type alias의 이름 'Title'도 사용할 수 있습니다. type alias가 generic이면, 전달된 타입들도 type object에서 확인할 수 있습니다.

```typescript
type Title<T> = T extends true ? string : number;

typeOf<Title<true>>();
{kind: 5, typeName: 'Title', typeArguments: [{kind: 7}]}
```

전달된 타입이 index access operator의 결과인 경우, container와 index 타입이 함께 존재합니다:

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

Interface와 object literal은 모두 Reflection.objectLiteral로 출력되며, `types` 배열에 Property와 Method를 포함합니다.

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
typeOf<User>(); //위와 동일한 객체를 반환
```

index signature도 `types` 배열에 있습니다.

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
typeOf<BagOfNumbers>(); //위와 동일한 객체를 반환
```

class는 object literal과 유사하며, `classType`(class 자체에 대한 reference)와 함께 `types` 배열 아래에 Property와 Method를 가집니다.

```typescript
class User {
  id: number = 0;
  username: string = '';
  login(password: string): void {
     //아무 것도 하지 않음
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

Reflection.propertySignature의 타입이 Reflection.property로, Reflection.methodSignature가 Reflection.method로 변경되었음을 주의하세요. class의 Property와 Method에는 추가 속성들이 있으므로 이 정보도 조회할 수 있습니다. 후자에는 `visibility`, `abstract`, `default`가 추가로 포함됩니다.
class의 type object에는 super-class의 Property와 Method가 아니라 해당 class 자신만의 Property와 Method만 포함됩니다. 이는 Interface/object literal의 type object가 모든 부모의 property signature와 method signature를 `types`에 해석해 포함하는 것과는 반대입니다. super-class의 Property와 Method를 해석하려면 ReflectionClass와 그 `ReflectionClass.getProperties()`(다음 섹션 참조) 또는 `@deepkit/type`의 `resolveTypeMembers()`를 사용할 수 있습니다.

type object는 정말 다양합니다. 예를 들어 literal, template literal, promise, enum, union, array, tuple 등 많은 것들이 있습니다. 어떤 것이 존재하며 어떤 정보가 제공되는지 알아보려면 `@deepkit/type`에서 `Type`을 import하는 것을 권장합니다. 이것은 TypeAny, TypeUnknonwn, TypeVoid, TypeString, TypeNumber, TypeObjectLiteral, TypeArray, TypeClass 등 모든 가능한 subtype을 포함한 `union`입니다. 거기에서 정확한 구조를 확인할 수 있습니다.

## Type 캐시

type alias, function, class에 대해 generic argument가 전달되지 않는 한 type object는 캐시됩니다. 이는 `typeOf<MyClass>()` 호출이 항상 동일한 객체를 반환한다는 의미입니다.

```typescript
type MyType = string;

typeOf<MyType>() === typeOf<MyType>(); //true
```

그러나 generic type이 사용되는 순간, 전달된 타입이 항상 동일하더라도 새로운 객체가 항상 생성됩니다. 이는 이론적으로 무한한 조합이 가능하며, 그런 캐시는 사실상 메모리 누수가 되기 때문입니다.

```typescript
type MyType<T> = T;

typeOf<MyType<string>>() === typeOf<MyType<string>>();
//false
```

다만, 재귀 타입에서 동일한 타입이 여러 번 인스턴스화되는 순간에는 캐시됩니다. 그러나 캐시의 지속 시간은 타입이 계산되는 순간으로만 제한되며 그 이후에는 존재하지 않습니다. 또한 Type object가 캐시되더라도 새로운 reference가 반환되며 동일한 객체 그 자체는 아닙니다.

```typescript
type MyType<T> = T;
type Object = {
   a: MyType<string>;
   b: MyType<string>;
};

typeOf<Object>();
```

`MyType<string>`는 `Object`가 계산되는 동안에만 캐시됩니다. 따라서 `a`와 `b`의 PropertySignature는 캐시에서 동일한 `type`을 가지지만, 동일한 Type object는 아닙니다.

모든 non-root Type object는 일반적으로 둘러싼 상위 객체를 가리키는 parent Property를 가집니다. 이는 예를 들어 어떤 Type이 union의 일부인지 아닌지 확인하는 데 유용합니다.

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

'Ref 1'은 실제 union type object를 가리킵니다.

위에서 예로 든 캐시된 Type object의 경우, `parent` Property가 항상 실제 부모를 가리키지는 않습니다. 예를 들어 동일한 class가 여러 번 사용되는 경우, 비록 `types`(TypePropertySignature와 TypeMethodSignature)의 즉각적인 타입은 올바른 TypeClass를 가리키지만, 이 signature 타입들의 `type`은 캐시된 항목의 TypeClass의 signature 타입들을 가리킵니다. 이는 부모 구조를 무한히 읽지 말고 즉각적인 부모만 읽도록 하기 위해 알아두어야 합니다. parent가 무한 정밀도를 가지지 않는 것은 성능상의 이유입니다.

## JIT 캐시

다음에 설명되는 일부 Function과 기능은 종종 type object를 기반으로 합니다. 이 중 일부를 성능 좋게 구현하기 위해서는 type object별 JIT(just in time) 캐시가 필요합니다. 이는 `getJitContainer(type)`를 통해 제공할 수 있습니다. 이 Function은 임의의 데이터를 저장할 수 있는 단순한 객체를 반환합니다. 그 객체에 대한 reference를 유지하지 않는 한, Type object 자체가 더 이상 reference되지 않을 때 GC에 의해 자동으로 삭제됩니다.


## Reflection Classes

`typeOf<>()` Function 외에도 Type objects에 대한 OOP 대안을 제공하는 다양한 reflection classes가 있습니다. 이 reflection classes는 class, Interface/object literal, function 및 그들의 직접적인 하위 타입들(Properties, Methods, Parameters)에 대해서만 사용할 수 있습니다. 더 깊은 타입은 다시 Type objects로 읽어야 합니다.

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


## 타입 정보 받기

타입을 대상으로 동작하는 Function을 제공하기 위해, 사용자에게 타입을 수동으로 전달할 수 있도록 하는 것이 유용할 수 있습니다. 예를 들어 validation Function에서는 첫 번째 type argument로 요청할 타입을, 첫 번째 function argument로 검증할 데이터를 제공하는 것이 유용할 수 있습니다.

```typescript
validate<string>(1234);
```

이 Function이 `string` 타입을 얻기 위해서는, type compiler에 이를 알려야 합니다.

```typescript
function validate<T>(data: any, type?: ReceiveType<T>): void;
```

첫 번째 type argument `T`에 대한 reference를 가진 `ReceiveType`은 type compiler에게 각 `validate` 호출 시 해당 타입을 두 번째 위치에 넣어야 함을 신호합니다(왜냐하면 `type`이 두 번째로 선언되어 있기 때문입니다). 그런 다음 런타임에 정보를 읽어내기 위해 `resolveReceiveType` Function을 사용합니다.

```typescript
import { resolveReceiveType, ReceiveType } from '@deepkit/type';

function validate<T>(data: any, type?: ReceiveType<T>): void {
    type = resolveReceiveType(type);
}
```

불필요하게 새 변수를 만들지 않도록 결과를 동일한 변수에 할당하는 것이 좋습니다. 이제 `type`에는 type object가 저장되거나, 예를 들어 type argument가 전달되지 않았거나, Deepkit의 type compiler가 올바르게 설치되지 않았거나, 타입 정보 방출이 활성화되지 않은 경우(위의 Installation 섹션 참조)에는 에러가 발생합니다.