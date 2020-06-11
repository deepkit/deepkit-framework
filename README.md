# Marshal.ts

<div align="center">
<img src="https://raw.github.com/marcj/marshal.ts/master/assets/marshal-logo.png" />
</div>

[![Build Status](https://travis-ci.com/marcj/marshal.ts.svg?branch=master)](https://travis-ci.com/marcj/marshal.ts)
[![npm version](https://badge.fury.io/js/%40marcj%2Fmarshal.svg)](https://badge.fury.io/js/%40marcj%2Fmarshal)
[![Coverage Status](https://coveralls.io/repos/github/marcj/marshal.ts/badge.svg?branch=master#)](https://coveralls.io/github/marcj/marshal.ts?branch=master)

Marshal is the **by far fastest** Javascript validation and serialization implementation to [marshal](https://en.wikipedia.org/wiki/Marshalling_(computer_science))
JSON-representable data from JSON objects to class instances to database records and vice versa, written in and for TypeScript. Marshal uses
a JIT engine, generating highly optimized serialization functions on the fly. Marshal is an addition to JSON.parse(), not a replacement.

Marshal introduces the concept of decorating your entity class or class methods *once* with all
necessary decorators (like type declaration, indices, and relations) using only Marshal's TypeScript decorators
agnostic to any serialization target by saving only the meta data,
and then use it everywhere: frontend, backend, CLI, database records, http-transport, rpc serialization, query parameter, DTOs, and database, including validations.

## Features

* [Fastest serialization and validation](#benchmark) thanks to a JIT engine. It's the the by far fastest serialization library for both, Nodejs and browsers.
* Supported types: String, Number, Boolean, Date, Moment.js, ArrayBuffer (binary), custom classes, Array, object maps, any.
* Typed arrays: Int8Array, Uint8Array, Uint8ClampedArray, Int16Array, Uint16Array, Int32Array, Uint32Array, Float32Array, Float64Array
* Cross referencing/Circular references using `@f.forwardRef`
* Constructor support (required property can be placed in constructor) making it suitable for Typescript strict compiling
* Validation: Built-in, custom class and inline validators
* Decorated property values (e.g. JSON uses plain Array<string>, class instance uses a custom Collection<String> class)
* Partial/Patch marshalling (ideal for serialising [JSON Patch](http://jsonpatch.com/) and the like)
* Complex models with parent references
* Support declaring method arguments and return type for method serialization
* Implicit type detection as far as Typescript allows it technically
* Supports getters
* One decorator for all. Best and mist efficient UX possible, with full type hinting support
* Soft type castings (so implicit cast from number -> string, if necessary)
* NestJS validation pipe
* MongoDB database abstraction and query builder with relation and join support

## Todo

* Add type support for native Map<T, K> and Set<T> classes
* Add more built-in validators

![Diagram](https://raw.github.com/marcj/marshal.ts/master/assets/diagram.png)

## Install

```
npm install @marcj/marshal reflect-metadata
```

Make sure you have `experimentalDecorators` and `emitDecoratorMetadata` enabled in tsconfig.json:

```
{
  "compilerOptions": {
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true
  }
}
```

If you use Webpack's `UglifyJsPlugin`, make sure names are not mangled (`mangle: false`), which is the default.
This is important to support constructor assignment. You can alternatively use asName() to hard code the constructor param names
as strings.

Make sure to import 'reflect-metadata' in your entry point scripts.

## Example

```typescript
import 'reflect-metadata';
import {
    f,
    plainToClass,
    uuid,
} from '@marcj/marshal';

class SubModel {
    @f label: string;
}

export enum Plan {
    DEFAULT,
    PRO,
    ENTERPRISE,
}

class SimpleModel {
    @f.primary().uuid()
    id: string = uuid();

    @f.array(String)
    tags: string[] = [];

    @f.optional() //binary
    picture?: ArrayBuffer;

    @f
    type: number = 0;

    @f.enum(Plan, /*allowLabelsAsValue=*/ true)
    plan: Plan = Plan.DEFAULT;

    @f.enum(Plan).asArray()
    plans: Plan[] = [];

    @f
    created: Date = new Date;

    @f.array(SubModel)
    children: SubModel[] = [];

    @f.map(SubModel)
    childrenMap: {[key: string]: SubModel} = {};

    constructor(
        @f.index().asName('name') //asName is required for minimized code
        public name: string
    ) {}
}

//data comes usually from files or http request
const instance = plainToClass(SimpleModel, {
    name: 'myName',
    tags: ['foo', 'bar'],
    plan: 'PRO',
    created: 'Sat Oct 13 2018 14:17:35 GMT+0200',
    children: [{label: 'foo'}],
    childrenMap: {'foo': {label: 'foo'}},
});
console.log(instance);
/*
    SimpleModel {
      id: 'f2ee05ad-ca77-49ea-a571-8f0119e03038',
      name: 'myName',
      tags: ['foo', 'bar']
      type: 0,
      plan: 1,
      created: 2018-10-13T17:02:34.456Z,
      children: [ SubModel { label: 'foo' } ],
      childrenMap: { foo: SubModel { label: 'bar' } }
    }
*/
```

## Benchmark

This library uses a JIT engine to convert data between class instances -> JSON objects and vice-versa. This means
it builds JS functions in the background once you request a serialization for a certain class. The JIT code is
then optimized further by the JS engine itself and then executed. By using as much information as possible
during during build-time allows to achieve the best performance possible.

See [bench.spec.ts](https://github.com/marcj/marshal.ts/blob/master/packages/benchmark/bench.spec.ts) for more details:

Tests were conducted on a Macbook Pro i9 with 2,9 GHz.
On real server hardware with Linux this numbers are easily halved.

The class structure in question:
```typescript
import 'reflect-metadata';
import {f, plainToClass} from "@marcj/marshal";

export class MarshalModel {
    @f ready?: boolean;

    @f.array(String) tags: string[] = [];

    @f priority: number = 0;

    constructor(
        @f public id: number,
        @f public name: string
    ) {
    }
}

plainToClass(MarshalModel, {
    name: 'name',
    id: 1,
    tags: ['a', 'b', 'c'],
    priority: 5,
    ready: true,
});
```

Converting **100,000 elements** from json to class instances (plainToClass) takes about **0.000184ms per item**, in total 18ms.

Converting **100,000 elements** from class instances to JSON objects (classToPlain) takes about **0.000089 per item**, in total 9ms.

**Compared to class-transformer**:
 1. classToPlain takes 2748ms. Marshal is up to 30500% faster.
 2. plainToClass takes 2605ms. Marshal is up to 21700% faster.

Another comparison: Creating manually new class instances and assign properties is only barely faster.

```typescript
const instance = new MarshalModel(1, 'name');
instance.tags = ['a', 'b', 'c'];
instance.priority = 5;
instance.ready = true;
````

Doing this 100,000 times takes 12.349ms instead of 18.483ms with Marshal.

**Validation**:

Validation is equally JIT optimized and by far the fastest validator for real use-cases (type and content validation with arrays, not only type checking).
Validating **100.000 objects** from the model above takes **0.000115ms per item**, in total 12ms.

Our [validation benchmark indicates](https://github.com/marcj/marshal.ts/blob/master/packages/benchmark/validation.spec.ts)
that Marshal is 64x faster than `ajv` and 3.6x faster than `quartet`.

Example:

```typescript
import {jitValidate} from '@marcj/marshal';
const data = {
    name: 'name1',
    id: 1,
    tags: ['a', 2, 'c'],
    priority: 5,
    ready: true,
};
const validateMarshalModel = jitValidate(MarshalModel);
const errors = validateMarshalModel(data);
```

## Usage

### Definition

Once your have defined your entity (see above) using the [@f decorators](https://marshal.marcj.dev/modules/_marcj_marshal.html#f) you can use one of Marshal's core methods
to transform data.

Note: Class fields that aren't annotated either by `@f` or any other decorator
won't be serialized. Their value will be dropped.

### Serialization

* JSON object to class instance (`plainToClass`).
* JSON object to mongo record (`plainToMongo`).

* class instance to JSON object (`classToPlain`).
* class instance to mongo record (`classToMongo`).

* mongo record to class instance (`mongoToClass`).
* mongo record to JSON object (`mongoToPlain`).

Note: 'JSON object' is not a string, but an object with valid JSON values, which can then
be used to serialise to JSON string using JSON.stringify(classToPlain(SimpleModel, ...)).

### Validation

You can validate incoming object literals or an class instance.

First make sure you have some validators attached to your fields you want to validate.

```typescript
import 'jest';
import 'reflect-metadata';
import {f, validate, ValidationError, validatedPlainToClass, plainToClass} from '@marcj/marshal';

class Page {
    @f
    name: string;
    
    @f
    age: number;
}

const errors = validate(Page, {name: 'peter'});
expect(errors.length).toBe(1);
expect(errors[0]).toBeInstanceOf(ValidationError);
expect(errors[0].path).toBe('age');
expect(errors[0].message).toBe('Required value is undefined or null');
if (errors.length === 0) {
    const page = plainToClass(Page, {name: 'peter'});
}

//or do both at the same time and throw error if validations fails
const page = validatedPlainToClass(Page, {name: 'peter'});
````

You can also write custom validators

```typescript
import {f, PropertyValidatorError, PropertyValidator} from '@marcj/marshal';

class MyCustomValidator implements PropertyValidator {
     validate<T>(value: any): PropertyValidatorError {
         if (value.length > 10) {
             return new PropertyValidatorError('too_long', 'Too long :()');
         }
     };
}

class Entity {
    @f.validator(MyCustomValidator)
    name: string;
}
```

or inline validators

```typescript
import {f, PropertyValidatorError} from '@marcj/marshal';

class Entity {
    @f.validator((value: any) => {
        if (value.length > 10) {
            return new PropertyValidatorError('too_long', 'Too long :()');
        }
    })
    name: string;
}
```


### Partial serialization

Most of the time, you want to have full class instances so the internal state is always valid.
However, if you have a patch mechanism, use JSON Patch, or just want to change one field value in the database,
you might have the need to serialize only one field.

* partialPlainToClass
* partialClassToPlain
* partialClassToMongo
* partialPlainToMongo
* partialMongoToPlain

## `@f` decorator: define types

Class fields are annotated using mainly [@f](https://marshal.marcj.dev/modules/_marcj_marshal.html#f).
You can define primitives, class mappings, relations between parents, and indices for the database (currently MongoDB).

Most of the time @f is able to detect the primitive type by reading the emitted meta data from TypeScript when you declared
the type correctly in Typescript. However, `@f` provides additional chainable methods to let you further define the type.
This duplication in defining the type is necessary since Typescript's reflection ability is only very rudimentary.

Example valid decoration:

```typescript
import {f} from '@marcj/marshal';

class Page {
    @f.optional() //will be detected as String
    name?: string;
    
    @f.array(String) //will be detected as String array
    name: string[] = [];
    
    @f.map(String) //will be detected as String map
    name: {[name: string]: string} = {};
}
````

Example *not* valid decorators:

```typescript
import {f} from '@marcj/marshal';

class Page {
    @f //can't be detected, you get an error with further instructions
    name;
}
````

More examples:

```typescript
import {f, uuid} from '@marcj/marshal';
importas moment from 'moment';

class MyModel {
    @f.primary().uuid()
    id: string = uuid();

    @f.optional().index()
    name?: string;

    @f
    created: Date = new Date;
    
    @f.moment()
    modified?: moment.Moment = moment();
}
```

### Method annotation

You can also annotate class methods and method arguments.
This can be useful for building custom RPC interfaces.

```typescript
import {
    f, PartialField, argumentClassToPlain, argumentPlainToClass,
    methodResultClassToPlain, methodResultPlainToClass,
} from '@marcj/marshal';

class Config {
    @f.optional()
    name?: string;

    @f.optional()
    sub?: Config;

    @f
    prio: number = 0;
}

class Controller {
    @f.partial(Config) //this defines the return type.
    foo(name: string): PartialField<Config> {
        return {prio: 2, 'sub.name': name};
    }

    @f //this register the function. `Config` type can be retrieve by TS reflection
    bar(config: Config): Config {
        config.name = 'peter';
        return config;
    }
    
    @f.array(Number) //return type. Necessary to specify array, since `number[]` is not inferable
    another(@f.array(String) names: string[]): number[] {
        return [1, 2];
    }
}

//from class to transport layer
const arg0 = argumentClassToPlain(Controller, 'foo', 0, 2); //'2'
const res = methodResultClassToPlain(Controller, 'foo', {'sub.name': 3}); //{'sub.name': '3'}

//from transport layer to 
const arg0 = argumentPlainToClass(Controller, 'bar', 0, {prio: '2'}); //Config {}
const res = methodResultPlainToClass(Controller, 'bar', {'sub': {name: 3}}); //Config {}
```

### Moment.js

Instead of `Date` object you can use `Moment` if `moment` is installed.

In MongoDB it's stored as `Date`. In JSON its encoded as ISO8601 string.

```typescript
import {f} from '@marcj/marshal';
importas moment from 'moment';

class MyModel {
    @f.moment()
    created?: moment.Moment = moment();
}
```

### Exclude

`exclude` lets you exclude properties from a class in a certain
direction. Per default it excludes to export to `*toPlain` and
`*toMongo`. You can also use `'mongo'` or `'plain'` to
have more control.
Note: Fields that are not decorated with `@f` are not mapped and will be excluded per default.

```typescript
import {f} from '@marcj/marshal';

class MyEntity {
    @f.primary().mongoId()
    id: string;
    
    @f.exclude()
    internalState: string;

    @f.exclude('mongo')
    publicState: string;
}
```

### ParentReference

`@ParentReference` together with `@f` is used for all `*ToClass` functions
and allows you to have the parent from instance of class given in `@f` assigned
as reference. Properties that used `@ParentReference` are automatically excluded
in `*ToPlain` and `*ToMongo` functions.

```typescript
import {f, ParentReference, plainToClass} from '@marcj/marshal';

class Page {
    @f
    name: string;
    
    @f.array(Page)
    children: Page[] = [];
    
    @f.type(Page)
    @ParentReference()
    parent?: Page;
}

const root = plainToClass(Page, {
    name: 'Root',
    children: [
        {name: 'Child 1'},
        {name: 'Child 2'},
    ]
})

root.children[0].parent === root; //true
````

### OnLoad(options?: {fullLoad?: boolean})

With `@OnLoad` you can register one or multiple callbacks
for the onLoad lifetime event. The registered method is called
when the class has been instantiated with the `*ToClass` functions.

If `fullLoad` is true, the callback is called when the whole chain
of objects has been created, which means when all parents and siblings
are fully initialised.

```typescript
import {f, OnLoad} from '@marcj/marshal';
class Page {
    @f
    name: string;
    
    @OnLoad()
    onLoad() {
        console.log('initialised');
    }
}
````

### Value decorator

`decorated()` lets you transform the actual class into something
different. This is useful if you have in the actual class instance
(plainToClass or mongoToClass) a wrapper for a certain property, for
example `string[]` => `ChildrenCollection`.

```typescript
import {f} from '@marcj/marshal';
class ChildrenCollection {
    
    constructor(
        @f.array(String).decorated()
        public items: string[]
    ) {
    }
    
    public add(item: string) {
        this.items.push(item);
    }
}

class MyEntity {
    @f.primary().mongoId()
    _id: string;
    
    //in *toMongo and *toPlain is children the value of ChildrenCollection::items
    @f.type(ChildrenCollection)
    children: ChildrenCollection = new ChildrenCollection([]);
}
```

`ChildrenCollection` is now always used in *toClass calls. The
constructor of ChildrenCollection receives the actual value as
first argument.

```typescript
import {classToPlain} from '@marcj/marshal';

const entity = new MyEntity();
entity.children.add('Foo');
entity.children.add('Bar');
const result = classToPlain(MyEntity, entity);
/*
result = {
    id: 'abcde',
    children: ['Foo', 'Bar']
}
*/
````

If you read values from mongo or plain to class (mongoToClass,
plainToClass) your decorator will be used again and receives as first
argument the actual property value:

```typescript
import {classToPlain} from '@marcj/marshal';

const entity = plainToClass(MyEntity, {
    id: 'abcde',
    children: ['Foo', 'Bar']
});
entity.children instanceof ChildrenCollection; //true

//so you can work with it again
entity.children.add('Bar2'); 
```

### Discriminated Union

`union` lets you define discriminated unions.

```typescript
class ConfigA {
    @f.discriminant()
    kind: 'a' = 'a';

    @f
    myValue: string = '';
}

class ConfigB {
    @f.discriminant()
    kind: 'b' = 'b';

    @f
    myValue2: string = '';
}

class User {
    @f.union(ConfigA, ConfigB)
    config: ConfigA | ConfigB = new ConfigA;
}
```

It's important to define always a default value for discriminants, otherwise you get an error.

You can use union types in array and map as well.

```typescript

class User {
    @f.map(ConfigA, ConfigB)
    configMap: {[name: string]: ConfigA | ConfigB) = {};

    @f.array(ConfigA, ConfigB)
    configs: (ConfigA | ConfigB)[] = [];
}
```

### External classes and interface serialization

Sometimes you need to work with external classes and are not able to decorate them directly. You can use `createClassSchema`
to create dynamically new class schemas for existing external classes or anonymouse classes.a

```typescript
class ExternalClass {
    id!: string;
    version!: number;
    lists!: number[];
}

const schema = createClassSchema(ExternalClass);
schema.addProperty('id', f.type(String));
schema.addProperty('version', f.type(Number));
schema.addProperty('lists', f.array(Number));

const obj = plainToClass(ExternalClass, {
    id: '23',
    version: 1,
    lists: [12, 23]
});
```

And with anonymous classes when you work with interfaces only.

```typescript
interface JustInterface {
    id!: string;
    version!: number;
    lists!: number[];
}

const schema = createClassSchema(class {});
schema.addProperty('id', f.type(String));
schema.addProperty('version', f.type(Number));
schema.addProperty('lists', f.array(Number));

const obj = plainToClass(schema.classType, {
    id: '23',
    version: 1,
    lists: [12, 23]
});
```

### Patch serialization

If you work with rather big entities, your probably want to utilise some
kind of patch mechanism. Marshal supports to transform partial objects as well
with deep path properties. All of following partial* methods maintain the
structure of your object and only transform the value. We resolve the dot symbol
to retrieve type information, so you can use this also in combination with JSON-Patch.

Note: partial* methods expect always a plain object and return always a plain object. For Example
`partialPlainToClass` indicates that all values *within* that plain object needs to be plain (JSON, e.g. string for dates).
`partialClassToString` indicates that all values *within* that plain object needs to be class instances (javascript, e.g. `Date` for dates).

#### partialPlainToClass

```typescript
import {partialPlainToClass} from '@marcj/marshal';

const converted = partialPlainToClass(SimpleModel, {
    id: 'abcde',
    ['childrenMap.item.label']: 3 
});

converted['childrenMap.item.label'] === '3' //true

const i2 = partialPlainToClass(SimpleModel, {
    'children': [{'label': 3}]
});
expect(i2['children'][0]).toBeInstanceOf(SubModel);
expect(i2['children'][0].label).toBe('3');
````

#### partialClassToPlain / partialClassToMongo

toPlain and toMongo differ in the way, that latter will transform
`mongoId`) and `uuid()` in different way, suitable for Mongo's binary storage.

```typescript
import {partialClassToPlain} from '@marcj/marshal';

const plain = partialClassToPlain(SimpleModel, {
    'children.0': i.children[0],
    'stringChildrenCollection': new StringCollectionWrapper(['Foo', 'Bar']),
    'childrenCollection': new CollectionWrapper([new SubModel('Bar3')]),
    'childrenCollection.1': new SubModel('Bar4'),
    'stringChildrenCollection.0': 'Bar2',
    'childrenCollection.2.label': 'Bar5',
});

expect(plain['children.0'].label).toBe('Foo');
expect(plain['stringChildrenCollection']).toEqual(['Foo', 'Bar']);
expect(plain['stringChildrenCollection.0']).toEqual('Bar2');
expect(plain['childrenCollection']).toEqual([{label: 'Bar3'}]);
expect(plain['childrenCollection.1']).toEqual({label: 'Bar4'});
expect(plain['childrenCollection.2.label']).toEqual('Bar5');
```

### Custom serialization target

In Marshal everything is compiled down to a highly optimized JS function. That means when you
want to add another serialization target, you have to write compiler templates. But it sounds
scarier than it is. Here's an example on how to convert a date to a ISO format for JSON transportation.

```typescript
import {registerConverterCompiler} from '@marcj/marshal';

//from class instance values to your MyTarget type, which will be a string here
registerConverterCompiler('class', 'MyTarget', 'date', (setter: string, accessor: string) => {
    return `${setter} = ${accessor}.toJSON();`;
});

//from your MyTarget type to class instance values 
registerConverterCompiler('MyTarget', 'class', 'date', (setter: string, accessor: string) => {
    return `${setter} = new Date(${accessor});`;
});
```

To use your custom target, you can use these JIT functions:

```typescript
import {ClassType, getClassName} from "@marcj/estdlib";
import {createClassToXFunction, createXToClassFunction} from '@marcj/marshal';
export function classToMyTarget<T>(classType: ClassType<T>, instance: T): any {
    if (!(instance instanceof classType)) {
        throw new Error(`Could not classToMyTarget since target is not a class instance of ${getClassName(classType)}`);
    }
    return createClassToXFunction(classType, 'MyTarget')(instance);
}

export function myTargetToClass<T>(classType: ClassType<T>, record: any, parents?: any[]): T {
    return createXToClassFunction(classType, 'MyTarget')(record, parents);
}
```

See [compiler templates of mongodb](https://github.com/marcj/marshal.ts/blob/master/packages/mongo/src/compiler-templates.ts)
and its [user facing API](https://github.com/marcj/marshal.ts/blob/master/packages/mongo/src/mapping.ts)
to get more examples.

## Patch / State management (ngRx etc) / Frozen objects

Marshal provides patch functions that enables you to patch class instances efficiently.

`applyPatch` to modify a given object partially and keeps references
that weren't updated untouched. This is very useful when working
with state management systems or dirty checking algorithms.

```typescript
import {applyPatch} from '@marcj/marshal';

class Sub {
    title: string = '';
    sub: Sub = new Sub;
}

class State {
    sub: Sub = new Sub();
    otherSub: Sub = new Sub();
    title: string = '';
}

const state = new State;
const newState = patchState(state, (state) => {
     state.sub.title = 'another-value';
});
state === newState //false, always the case
state.sub === newState.sub //false, because we changed it
state.otherSub === newState.otherSub //true, since unchanged

const newState2 = patchState(state, (state) => {
     state.otherSub.sub.title = 'another-value';
});
state === newState2 //false, always the case
state.sub === newState2.sub //true, because we haven't changed it nor its children
state.otherSub === newState2.otherSub //false, since we deeply changed it
```

This function is perfect for state managers and complex state models. Normally you would use a syntax like the following
to update your state:

```typescript
on(action, (state) => {
    return {...state, loggedIn: true, user: {...state.user, username: 'peter'};
}
```

Using this approach with the spread operator has 2 main disadvantages:
1. You lose class instances. E.g. `{...state.user}` creates a new plain object instead of a `User` object.
2. That works only for shallow models. As soon as your application grows your state does so as well and this ends up in
very dirty code.

With Marshal you can easily handle very complex state models while keeping your class instances and maintaining reference
integrity of untouched objects, necessary for state managers to detect changes. With Marshal this would look like this:

```typescript
on(action, (state) => {
    return applyPatch(state, (state) => {
        state.loggedIn = true;
        state.user.username = 'peter';
    })
}
```

You see, using such a method allows you to work with very deep nested objects in states.

`applyAndReturnPatches` returns instead of the new object a path->value object of changes made to the object.
This object can be easily used to feed MongoDB to do only partial updates.

```typescript
const state = new State;
const patches = applyAndReturnPatches(state, (state) => {
     state.sub.title = 'another-value';
});

patches === {
    'sub.title' = 'another-value';
}
```

This function helps you to generate easily patch objects by just manipulating your
objects as normal instead of generating this patch object manually.

## Mongo ORM / Database abstraction

Marshal's MongoDB database abstraction makes it super easy to
retrieve and store data from and into your MongoDB. We make sure the
data from your JSON or class instance is correctly converted to MongoDB
specific types and inserted IDs are applied to your class instance.

See [documentation](https://marshal.marcj.dev/modules/_marcj_marshal.html) for more information;

```
npm install @marcj/marshal-mongo
```

```typescript
import {Database, Connection} from "@marcj/marshal-mongo";

const database = new Database(new Connection('localhost', 'mydb', 'username', 'password'));

const instance = new SimpleModel('My model');
await database.add(instance);

const list = await database.query(SimpleModel).find();
const oneItem = await database.query(SimpleModel).filter({id: 'f2ee05ad-ca77-49ea-a571-8f0119e03038'}).findOne();
```

More documention to come.

## NestJS / Express


It's super common to accept data from a frontend via HTTP, transform the
body into your class instance, work with it, and then store that data in
your MongoDB or somewhere else. With Marshal this scenario is super
simple and you do not need any manual transformations.


```
npm install @marcj/marshal-nest
```

```typescript
import 'reflect-metadata';
import {
    Controller, Get, Param, Post, Body
} from '@nestjs/common';

import {Database, Connection} from "@marcj/marshal-mongo";
import {SimpleModel} from "@marcj/marshal/tests/entities";
import {classToPlain} from "@marcj/marshal";
import {ValidationPipe} from "@marcj/marshal-nest";

@Controller()
class MyController {
    private database = new Database(new Connection('localhost', 'testing');

    @Post('/save')
    async save(
        @Body(ValidationPipe({transform: true})) body: SimpleModel,
    ) {
        body instanceof SimpleModel; // true;
        await this.database.add(body);
        
        return body.id;
    }
    
    @Get('/get/:id')
    async get(@Param('id') id: string) {
        const instance = await this.database.query(SimpleModel).filter({_id: id}).findOne();

        return classToPlain(SimpleModel, instance);
    }
}

````

## Development of this package

How to release:

```
# remove packages/*/lib folders
# develop changes, run tests
./node_modules/.bin/jest --coverage

# build TS
lerna run tsc

# publish
lerna publish patch
```
