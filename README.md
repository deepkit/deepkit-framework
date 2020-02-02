# Marshal.ts

![Marshal](https://raw.github.com/marcj/marshal.ts/feature/jit/assets/marshal-logo.png)

[![Build Status](https://travis-ci.com/marcj/marshal.ts.svg?branch=master)](https://travis-ci.com/marcj/marshal.ts)
[![npm version](https://badge.fury.io/js/%40marcj%2Fmarshal.svg)](https://badge.fury.io/js/%40marcj%2Fmarshal)
[![Coverage Status](https://coveralls.io/repos/github/marcj/marshal.ts/badge.svg?branch=master)](https://coveralls.io/github/marcj/marshal.ts?branch=master)

Marshal is the **by far fastest** Javascript serialization implementation to [marshal](https://en.wikipedia.org/wiki/Marshalling_(computer_science))
JSON-representable data from JSON object to class instance to database records and vice versa, written in and for TypeScript.

Marshal introduces the concept of decorating your entity class or class methods *once* with all
necessary annotations (like type declaration, indices, and relations) using only Marshal's TypeScript decorators
agnostic to any serialization target by saving only the meta data,
and then use it everywhere: frontend, backend, http-transport, rpc serialization, query parameter, DTOs, and database, including validations.

The goal is to support all types of structures/use-cases where you need to serialize and validate data in a very user-friendly
way while providing the fastest possible serializer for all platforms, NodeJS and browsers.

Marshal shines particularly when you have an application written in Typescript entirely, frontend, CLI, and backend.
This allows you to save tons of time by moving your entities, DTO, query parameter signature, etc all as Marshal decorated classes in a `common`
package (super simple with [Lerna](https://github.com/lerna/lerna)). You then use and import these classes in your frontend, cli, backend, or whatever you develop.


## Features

* Fastest serialization thanks to a JIT engine
* Supported types: String, Number, Boolean, Date, Momemt.js, ArrayBuffer (binary), custom classes, Array, object maps, any.
* Typed arrays: Int8Array, Uint8Array, Uint8ClampedArray, Int16Array, Uint16Array, Int32Array, Uint32Array, Float32Array, Float64Array
* Cross referencing/Circular references using `@f.forwardRef`
* Constructor support (required property can be placed in constructor) making it suitable for Typescript strict compiling
* Validation: Built-in, custom class and inline validators
* Decorated property values (e.g. JSON uses plain Array<string>, class instance uses a custom Collection<String> class)
* Partial/Patch marshalling (ideal for serialising [JSON Patch](http://jsonpatch.com/) and the like)
* Complex models with parent references
* Supports getters
* Entity definition export to TypeORM (currently columns + indices), so you don't have to decorate twice.
* NestJS validation pipe
* MongoDB database abstraction and query builder with relation support

## Todo

* Add type support for: Map<T, K>, Set<T>
* Add more built-in validators
* Support discriminators (union class types)
* Add automatic tests IE11+ (help is welcome)

![Diagram](https://raw.github.com/marcj/marshal.ts/master/assets/diagram.png)

## Install

```
npm install @marcj/marshal reflect-metadata
```

Install `buffer` as well if you want to have binary (ArrayBuffer, TypedArrays) support in browsers.

## Example Entity

```typescript
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

    @f.enum(Plan)
    plan: Plan = Plan.DEFAULT;

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
it builds JS functions in the background once you request a serialization for a certain class. The build JS is
optimized by the JS engine itself and then executed. By using as much as information during build-time possible
to generate the smallest and fastest code possible allows to achieve the best performance yet available for serialization
in Javascript.

See [bench.spec.ts](https://github.com/marcj/marshal.ts/blob/feature/jit/packages/benchmark/bench.spec.ts) for more details:

The class structure in question:
```typescript
```typescript
import {f} from "@marcj/marshal";

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
```

Converting 100,000 elements from json to class instances takes about 0.00067 ms per item, in total 7ms.

Converting 100,00 elements from class instances to JSON objects takes about 0.00040ms per item, in total 4ms.

For comparison: This is up to 6,000% faster than class-transformer.


## Usage

### Config

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
expect(errors[0].message).toBe('Required value is undefined');
if (errors.length === 0) {
    const page = plainToClass(Page, {name: 'peter'});
}

//or do both at the same time and throw error if validations fails
const page = validatedPlainToClass(Page, {name: 'peter'});
````

You can also custom validators

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
import * as moment from 'moment';

class MyModel {
    @f.primary().uuid()
    id: string = uuid();

    @f.optional().index()
    name?: string;

    @f()
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
    another(@f.array(String) names: string): number[] {
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
import * as moment from 'moment';

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
    @f.array(String).decorated()
    items: string[];
    
    constructor(items: string[]) {
        this.items = items;
    }
    
    public add(item: string) {
        this.items.push(item);
    }
}

class MyEntity {
    @f.primary().mongoId()
    id: string;
    
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

### Patch transformations

If you work with rather big entities, your probably want to utilise some
kind of patch mechanism. Marshal supports to transform partial objects as well
with deep path properties. All of following partial* methods maintain the
structure of your object and only transform the value. We resolve the dot symbol
to retrieve type information, so you can use this also in combination with JSON-Patch.

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

### TypeORM

The meta information about your entity can be exported to TypeORM EntitySchema.

```typescript
// typeorm.js
import {getTypeOrmEntity} from "@marcj/marshal-mongo";

const TypeOrmSchema = getTypeOrmEntity(MyEntity);
module.exports = {
    type: "mongodb",
    host: "localhost",
    port: 27017,
    database: "test",
    useNewUrlParser: true,
    synchronize: true,
    entities: [TypeOrmSchema]
}
```

Marshal.ts uses only TypeORM for connection abstraction and to generate a `EntitySchema` for your typeOrm use-cases.
You need in most cases only to use the `@f` decorator with some additional function calls (primary, index, etc) on your entity.

You can generate a schema for Typeorm using  `getTypeOrmEntity` and then pass this to your `createConnection` call,
which makes it possible to sync the schema defined only with Marshal decorators with your database managed by Typeorm.


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
import {Database} from "@marcj/marshal-mongo";
import {createConnection} from "typeorm";

(async () => {
const connection = await createConnection({
    type: "mongodb",
    host: "localhost",
    port: 27017,
    database: "testing",
    useNewUrlParser: true,
});
const database = new Database(connection, 'testing');

const instance = new SimpleModel('My model');
await database.add(instance);

const list = await database.find(SimpleModel).find();
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
import {
    Controller, Get, Param, Post, Body
} from '@nestjs/common';

import {SimpleModel} from "@marcj/marshal/tests/entities";
import {Database, classToPlain} from "@marcj/marshal";
import {ValidationPipe} from "@marcj/marshal-nest";

@Controller()
class MyController {
    private database: Database;
    
    private async getDatabase() {
        if (!this.database) {
            const connection = await createConnection({
                type: "mongodb",
                host: "localhost",
                port: 27017,
                database: "testing",
                useNewUrlParser: true,
            });
            this.database = new Database(connection, 'testing');
        }
        
        return this.database;
    }
    
    @Post('/save')
    async save(
        @Body(ValidationPipe({transform: true})) body: SimpleModel,
    ) {
        body instanceof SimpleModel; // true;
        const versionNumber = await (await this.getDatabase()).save(SimpleModel, body);
        
        return body.id;
    }
    
    @Get('/get/:id')
    async get(@Param('id') id: string) {
        const instance = await (await this.getDatabase()).get(SimpleModel, {_id: id});

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
