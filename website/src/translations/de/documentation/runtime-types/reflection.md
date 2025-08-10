# Reflection

Um direkt mit den Typinformationen selbst zu arbeiten, gibt es zwei grundlegende Varianten: Type-Objekte und Reflection-Klassen. Type-Objekte sind reguläre JS-Objekte, die von `typeOf<T>()` zurückgegeben werden. Reflection-Klassen werden unten besprochen.


Die Function `typeOf` funktioniert für alle Types, einschließlich Interfaces, object literals, Classes, Functions und Type Aliases. Sie gibt ein Type-Objekt zurück, das alle Informationen über den Type enthält. Du kannst jeden Type als Type Argument übergeben, einschließlich Generics.

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

Das Type-Objekt ist ein einfaches object literal, das eine Property `kind` enthält, die den Typ des Type-Objekts angibt. Die Property `kind` ist eine Zahl und erhält ihre Bedeutung aus dem Enum `ReflectionKind`. `ReflectionKind` ist im Package `@deepkit/type` wie folgt definiert:

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

  //... und noch mehr
}
```

Es gibt eine Reihe möglicher Type-Objekte, die zurückgegeben werden können. Die einfachsten sind `never`, `any`, `unknown`, `void, null,` und `undefined`, die wie folgt dargestellt werden:

```typescript
{kind: 0}; //never
{kind: 1}; //any
{kind: 2}; //unknown
{kind: 3}; //void
{kind: 10}; //null
{kind: 11}; //undefined
```

Beispielsweise ist die Zahl 0 der erste Eintrag des `ReflectionKind`-Enums, in diesem Fall `never`, die Zahl 1 ist der zweite Eintrag, hier `any`, und so weiter. Dementsprechend werden primitive Types wie `string`, `number`, `boolean` wie folgt dargestellt:

```typescript
typeOf<string>(); //{kind: 5}
typeOf<number>(); //{kind: 6}
typeOf<boolean>(); //{kind: 7}
```

Diese eher einfachen Types haben keine weiteren Informationen am Type-Objekt, da sie direkt als Type Argument an `typeOf` übergeben wurden. Wenn Types jedoch über Type Aliases übergeben werden, sind zusätzliche Informationen am Type-Objekt zu finden.

```typescript
type Title = string;

typeOf<Title>(); //{kind: 5, typeName: 'Title'}
```

In diesem Fall ist auch der Name des Type Alias 'Title' verfügbar. Wenn ein Type Alias ein Generic ist, sind die übergebenen Types ebenfalls am Type-Objekt verfügbar.

```typescript
type Title<T> = T extends true ? string : number;

typeOf<Title<true>>();
{kind: 5, typeName: 'Title', typeArguments: [{kind: 7}]}
```

Wenn der übergebene Type das Ergebnis eines Index Access Operators ist, sind der Container und der Index Type vorhanden:

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

Interfaces und object literals werden beide als Reflection.objectLiteral ausgegeben und enthalten die Properties und Methods im Array `types`.

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
typeOf<User>(); //gibt dasselbe Objekt wie oben zurück
```

Index Signatures befinden sich ebenfalls im Array `types`.

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
typeOf<BagOfNumbers>(); //gibt dasselbe Objekt wie oben zurück
```

Classes sind ähnlich wie object literals und haben zusätzlich zu `classType`, welches eine Referenz auf die Class selbst ist, ihre Properties und Methods unter einem `types`-Array.

```typescript
class User {
  id: number = 0;
  username: string = '';
  login(password: string): void {
     //nichts tun
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

Beachte, dass sich der Type von Reflection.propertySignature zu Reflection.property und Reflection.methodSignature zu Reflection.method geändert hat. Da Properties und Methods auf Classes zusätzliche Attribute haben, können diese Informationen ebenfalls abgefragt werden. Letztere enthalten zusätzlich `visibility`, `abstract` und `default`.
Type-Objekte von Classes enthalten nur die Properties und Methods der Class selbst und nicht der Super-Classes. Dies steht im Gegensatz zu Type-Objekten von Interfaces/object literals, die alle Property Signatures und Method Signatures aller Parents im `types`-Array aufgelöst haben. Um die Properties und Methods der Super-Classes aufzulösen, können entweder ReflectionClass und dessen `ReflectionClass.getProperties()` (siehe folgende Abschnitte) oder `resolveTypeMembers()` aus `@deepkit/type` verwendet werden.

Es gibt eine ganze Fülle an Type-Objekten. Zum Beispiel für literal, template literals, promise, enum, union, array, tuple und viele mehr. Um herauszufinden, welche es alle gibt und welche Informationen verfügbar sind, wird empfohlen, `Type` aus `@deepkit/type` zu importieren. Es ist ein `union` mit allen möglichen Subtypes wie TypeAny, TypeUnknonwn, TypeVoid, TypeString, TypeNumber, TypeObjectLiteral, TypeArray, TypeClass und vielen mehr. Dort findest du die genaue Struktur.

## Type Cache

Type-Objekte werden für Type Aliases, Functions und Classes gecacht, sobald kein Generic-Argument übergeben wird. Das bedeutet, ein Aufruf von `typeOf<MyClass>()` gibt immer dasselbe Objekt zurück.

```typescript
type MyType = string;

typeOf<MyType>() === typeOf<MyType>(); //true
```

Sobald jedoch ein Generic Type verwendet wird, werden immer neue Objekte erstellt, selbst wenn der übergebene Type immer derselbe ist. Dies liegt daran, dass theoretisch eine unendliche Anzahl von Kombinationen möglich ist und ein solcher Cache effektiv ein Memory Leak wäre.

```typescript
type MyType<T> = T;

typeOf<MyType<string>>() === typeOf<MyType<string>>();
//false
```

Sobald ein Type jedoch in einem rekursiven Type mehrfach instanziiert wird, wird er gecacht. Die Dauer des Caches ist jedoch nur auf den Moment begrenzt, in dem der Type berechnet wird, und existiert danach nicht mehr. Außerdem wird zwar das Type-Objekt gecacht, es wird aber eine neue Referenz zurückgegeben und ist nicht exakt dasselbe Objekt.

```typescript
type MyType<T> = T;
type Object = {
   a: MyType<string>;
   b: MyType<string>;
};

typeOf<Object>();
```

`MyType<string>` wird so lange gecacht, wie `Object` berechnet wird. Die PropertySignature von `a` und `b` haben somit denselben `type` aus dem Cache, sind aber nicht dasselbe Type-Objekt.

Alle nicht-root Type-Objekte haben eine Property `parent`, die üblicherweise auf den umschließenden Parent zeigt. Dies ist zum Beispiel wertvoll, um herauszufinden, ob ein Type Teil einer Union ist oder nicht.

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

‚Ref 1‘ zeigt auf das eigentliche Union Type-Objekt.

Bei gecachten Type-Objekten wie oben exemplarisch dargestellt, sind die `parent`-Properties nicht immer die echten Parents. Beispielsweise bei einer Class, die mehrfach verwendet wird: Obwohl unmittelbare Types in `types` (TypePropertySignature und TypeMethodSignature) auf die korrekte TypeClass zeigen, zeigen die `type`-Properties dieser Signature Types auf die Signature Types der TypeClass des gecachten Eintrags. Das ist wichtig zu wissen, um nicht die Parent-Struktur unendlich zu traversieren, sondern nur den unmittelbaren Parent. Die Tatsache, dass der Parent keine unendliche Präzision hat, ist aus Performance-Gründen so.

## JIT Cache

Im weiteren Verlauf werden einige Functions und Features beschrieben, die oft auf den Type-Objekten basieren. Um einige davon performant zu implementieren, wird ein JIT (just in time) Cache pro Type-Objekt benötigt. Dieser kann über `getJitContainer(type)` bereitgestellt werden. Diese Function gibt ein einfaches Objekt zurück, auf dem beliebige Daten gespeichert werden können. Solange keine Referenz auf das Objekt gehalten wird, wird es automatisch vom GC gelöscht, sobald das Type-Objekt selbst ebenfalls nicht mehr referenziert wird.


## Reflection-Klassen

Zusätzlich zur Function `typeOf<>()` gibt es verschiedene Reflection-Klassen, die eine OOP-Alternative zu den Type-Objekten bieten. Die Reflection-Klassen sind nur für Classes, Interface/object literals und Functions sowie deren direkte Sub-Types (Properties, Methods, Parameters) verfügbar. Alle tieferen Types müssen wieder mit den Type-Objekten gelesen werden.

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


## Typinformationen empfangen

Um Functions bereitzustellen, die auf Types operieren, kann es nützlich sein, dem Benutzer anzubieten, einen Type manuell zu übergeben. Zum Beispiel könnte es in einer Validierungsfunction sinnvoll sein, den anzufordernden Type als erstes Type Argument und die zu validierenden Daten als erstes Function Argument bereitzustellen.

```typescript
validate<string>(1234);
```

Damit diese Function den Type `string` erhält, muss sie dies dem Type Compiler mitteilen.

```typescript
function validate<T>(data: any, type?: ReceiveType<T>): void;
```

`ReceiveType` mit dem Verweis auf das erste Type Argument `T` signalisiert dem Type Compiler, dass jeder Aufruf von `validate` den Type an zweiter Stelle ablegen soll (da `type` an zweiter Stelle deklariert ist). Um die Informationen zur Laufzeit auszulesen, wird anschließend die Function `resolveReceiveType` verwendet.

```typescript
import { resolveReceiveType, ReceiveType } from '@deepkit/type';

function validate<T>(data: any, type?: ReceiveType<T>): void {
    type = resolveReceiveType(type);
}
```

Es ist sinnvoll, das Ergebnis derselben Variable zuzuweisen, um nicht unnötig eine neue zu erstellen. In `type` ist nun entweder ein Type-Objekt gespeichert oder es wird ein Error geworfen, wenn z. B. kein Type Argument übergeben wurde, Deepkits Type Compiler nicht korrekt installiert wurde oder das Emittieren von Typinformationen nicht aktiviert ist (siehe den Abschnitt Installation oben).