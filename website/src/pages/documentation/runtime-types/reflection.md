# Reflection

To work directly with the type information itself, there are two basic variants: Type objects and Reflection classes. Type objects are regular JS objects returned by `typeOf<T>()`. Reflection classes are discussed below.


The function `typeOf` works for all types, including interfaces, object literals, classes, functions, and type aliases. It returns a type object that contains all the information about the type. You can pass any type as a type argument, including generics.

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

The type object is a simple object literal that contains a `kind` property that indicates the type of the type object. The `kind` property is a number and gets its meaning from the enum `ReflectionKind`. `ReflectionKind` is defined in the `@deepkit/type` package as follows:

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

There are a number of possible type objects that can be returned. The simplest ones are `never`, `any`, `unknown`, `void, null,` and `undefined`, which are represented as follows:

```typescript
{kind: 0}; //never
{kind: 1}; //any
{kind: 2}; //unknown
{kind: 3}; //void
{kind: 10}; //null
{kind: 11}; //undefined
```

For example, number 0 is the first entry of the `ReflectionKind` enum, in this case `never`, number 1 is the second entry, here `any`, and so on. Accordingly, primitive types like `string`, `number`, `boolean` are represented as follows:

```typescript
typeOf<string>(); //{kind: 5}
typeOf<number>(); //{kind: 6}
typeOf<boolean>(); //{kind: 7}
```

These rather simple types have no further information at the type object, because they were passed directly as type argument to `typeOf`. However, if types are passed via type aliases, additional information can be found at the type object.

```typescript
type Title = string;

typeOf<Title>(); //{kind: 5, typeName: 'Title'}
```

In this case, the name of the type alias 'Title' is also available. If a type alias is a generic, the types passed will also be available at the type object.

```typescript
type Title<T> = T extends true ? string : number;

typeOf<Title<true>>();
{kind: 5, typeName: 'Title', typeArguments: [{kind: 7}]}
```

If the type passed is the result of an index access operator, the container and the index type are present:

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

Interfaces and object literals are both output as Reflection.objectLiteral and contain the properties and methods in the `types` array.

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
typeOf<User>(); //returns the same object as above
```

Index signatures are also in the `types` array.

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
typeOf<BagOfNumbers>(); //returns the same object as above
```

Classes are similar to object literals and also have their properties and methods under a `types` array in addition to `classType` which is a reference to the class itself.

```typescript
class User {
  id: number = 0;
  username: string = '';
  login(password: string): void {
     //do nothing
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

Note that the type of Reflection.propertySignature has changed to Reflection.property and Reflection.methodSignature has changed to Reflection.method. Since properties and methods on classes have additional attributes, this information can also be retrieved. The latter additionally include `visibility`, `abstract`, and `default`.
Type objects of classes contain only the properties and methods of the class itself and not of super-classes. This is contrary to type objects of interfacesobject-literals, which have all property signatures and method signatures of all parents resolved into `types`. To resolve the property and methods of the super-classes, either ReflectionClass and its `ReflectionClass.getProperties()` (see following sections) or `resolveTypeMembers()` of `@deepkit/type` can be used.

There is a whole plethora of type objects. For example for literal, template literals, promise, enum, union, array, tuple, and many more. To find out which ones all exist and what information is available, it is recommended to import `Type` from `@deepkit/type`. It is a `union` with all possible subtypes like TypeAny, TypeUnknonwn, TypeVoid, TypeString, TypeNumber, TypeObjectLiteral, TypeArray, TypeClass, and many more. There you can find the exact structure.

## Type Cache

Type objects are cached for type aliases, functions, and classes as soon as no generic argument is passed. This means that a call to `typeOf<MyClass>()` always returns the same object.

```typescript
type MyType = string;

typeOf<MyType>() === typeOf<MyType>(); //true
```

However, as soon as a generic type is used, new objects are always created, even if the type passed is always the same. This is because an infinite number of combinations are theoretically possible and such a cache would effectively be a memory leak.

```typescript
type MyType<T> = T;

typeOf<MyType<string>>() === typeOf<MyType<string>>();
//false
```

However, as soon as a type is instantiated multiple times in a recursive type, it is cached. However, the duration of the cache is limited only to the moment the type is computed and does not exist thereafter. Also, although the Type object is cached, a new reference is returned and is not the exact same object.

```typescript
type MyType<T> = T;
type Object = {
   a: MyType<string>;
   b: MyType<string>;
};

typeOf<Object>();
```

`MyType<string>` is cached as long as `Object` is computed. The PropertySignature of `a` and `b` thus have the same `type` from the cache, but are not the same Type object.

All non-root Type objects have a parent property, which usually points to the enclosing parent. This is valuable, for example, to find out whether a Type is part of a union or not.

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

'Ref 1' points to the actual union type object.

For cached Type objects as exemplified above, the `parent` properties are not always the real parents. For example, for a class that is used multiple times, although immediate types in `types` (TypePropertySignature and TypeMethodSignature) point to the correct TypeClass, the `type` of these signature types point to the signature types of the TypeClass of the cached entry. This is important to know so as not to infinitely read the parent structure, but only the immediate parent. The fact that the parent does not have infinite precision is due to performance reasons.

## JIT Cache

In the further course some functions and features are described, which are often based on the type objects. To implement some of them in a performant way, a JIT (just in time) cache per type object is needed. This can be provided via `getJitContainer(type)`. This function returns a simple object on which arbitrary data can be stored. As long as no reference to the object is held, it will be deleted automatically by the GC as soon as the Type object itself is also no longer referenced.


## Reflection Classes

In addition to the `typeOf<>()` function, there are various reflection classes that provide an OOP alternative to the Type objects. The reflection classes are only available for classes, InterfaceObject literals and functions and their direct sub-types (Properties, Methods, Parameters). All deeper types must be read again with the Type objects.

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


## Receive type information

In order to provide functions that operate on types, it can be useful to offer the user to pass a type manually. For example, in a validation function, it might be useful to provide the type to be requested as the first type argument and the data to be validated as the first function argument.

```typescript
validate<string>(1234);
```

In order for this function to get the type `string`, it must tell this to the type compiler.

```typescript
function validate<T>(data: any, type?: ReceiveType<T>): void;
```

`ReceiveType` with the reference to the first type arguments `T` signals the type compiler that each call to `validate` should put the type in second place (since `type` is declared in second place). To then read out the information at runtime, the `resolveReceiveType` function is used.

```typescript
import { resolveReceiveType, ReceiveType } from '@deepkit/type';

function validate<T>(data: any, type?: ReceiveType<T>): void {
    type = resolveReceiveType(type);
}
```

It is useful to assign the result to the same variable to avoid creating a new one unnecessarily. In `type` now either a type object is stored or an error is thrown, if for example no type argument was passed, Deepkit's type compiler was not installed correctly, or the emitting of type information is not activated (see the section Installation above).
