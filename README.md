# Marshal

[![Build Status](https://travis-ci.com/marcj/marshal.ts.svg?branch=master)](https://travis-ci.com/marcj/marshal.ts)
[![npm version](https://badge.fury.io/js/%40marcj%2Fmarshal.svg)](https://badge.fury.io/js/%40marcj%2Fmarshal)
[![Coverage Status](https://coveralls.io/repos/github/marcj/marshal.ts/badge.svg?branch=master)](https://coveralls.io/github/marcj/marshal.ts?branch=master)

Marshal is a library to [marshal](https://en.wikipedia.org/wiki/Marshalling_(computer_science))
JSON-representable data from JSON to class instance to Database and vice versa.

If you have data models in your frontend, Node backend, and Database,
then Marshal helps you to convert and validate between all those correctly.
The result is having only one entity and validation definition for all sides at once.

## Features

* Supported types: String, Number, Boolean, Date, Binary, custom classes, Array, Map, any.
* Fast marshalling from and to JSON
* Fast marshalling from and to MongoDB
* Constructor support (required property can be placed in constructor)
* Decorators support (e.g. JSON uses plain Array<string>, class instance uses a custom Collection<String> class)
* Patch marshalling (ideal for serialising [JSON Patch](http://jsonpatch.com/))
* Complex models with parent references
* Supports getter as fields
* Entity definition export to TypeORM (currently only columns + indices)
* Validation: Built-in, custom class and inline validators
* NestJS validation pipe


## Todo

* Add more built-in validators
* Support discriminators (union class types)
* Add support for TypeORM types completely (so we support MySQL, Postgres, SQLiTe, etc.), currently we use TypeOrm's Connection abstraction.

![Diagram](https://raw.github.com/marcj/marshal.ts/master/assets/diagram.png)

## Install

```
npm install @marcj/marshal reflect-metadata
```

Install `buffer` as well if you want to have Binary support.

## Example Entity

```typescript
import {
    Field,
    Entity,
    IDField,
    UUIDField,
    EnumField,
    plainToClass,
    uuid,
    Optional,
    Index,
} from '@marcj/marshal';
import {Buffer} from 'buffer';

class SubModel {
    @Field()
    label: string;
}

export enum Plan {
    DEFAULT,
    PRO,
    ENTERPRISE,
}

class SimpleModel {
    @IDField()
    @UUIDField()
    id: string = uuid();

    @Field([String])
    tags: string[] = [];

    @Field(Buffer) //binary
    @Optional()
    picture?: Buffer;

    @Field()
    type: number = 0;

    @EnumField(Plan)
    plan: Plan = Plan.DEFAULT;

    @Field()
    created: Date = new Date;

    @Field([SubModel])
    children: SubModel[] = [];

    @Field({SubModel})
    childrenMap: {[key: string]: SubModel} = {};

    constructor(
        @Field() 
        @Index() 
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

### Definition

Once your have defined your entity (see above) using the [@Field decorators](modules/_marcj_marshal.html#field) you can use one of Marshal's core methods
to transform data.

Note: Class fields that aren't annotated either by @Field() or any other decorator
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
import {Field, validate, ValidationError} from '@marcj/marshal';

class Page {
    @Field()
    name: string;
    
    @Field()
    age: number;
}

const errors = validate(Page, {name: 'peter'});
expect(errors.length).toBe(1);
expect(errors[0]).toBeInstanceOf(ValidationError);
expect(errors[0].path).toBe('age');
expect(errors[0].message).toBe('Required value is undefined');
````

You can also custom validators

```typescript
import {Field, AddValidator, PropertyValidator, PropertyValidatorError, ClassType} from '@marcj/marshal';

class MyCustomValidator implements PropertyValidator {
     async validate<T>(value: any, target: ClassType<T>, propertyName: string): Promise<PropertyValidatorError | void> {
         if (value.length > 10) {
             return new PropertyValidatorError('Too long :()');
         }
     };
}

class Entity {
    @Field()
    @AddValidator(MyCustomValidator)
    name: string;
}
```

or inline validators

```typescript
import {Field, AddValidator, InlineValidator, ClassType} from '@marcj/marshal';

class Entity {
    @Field()
    @InlineValidator(async (value: any) => {
        if (value.length > 10) {
             throw new Error('Too long :()');
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

## Types

Class fields are annotated using mainly [@Field decorators](modules/_marcj_marshal.html#field).
You can define primitives, class mappings, relations between parents, and indices for the database (currently MongoDB).

See [documentation of @marcj/marshal](./modules/_marcj_marshal.html) for all available decorators. (Search for "Category: Decorator")

## TypeORM

The meta information about your entity can be exported to TypeORM EntitySchema.

```typescript
import {getTypeOrmEntity} from "@marcj/marshal-mongo";

const TypeOrmSchema = getTypeOrmEntity(MyEntity);
```

### Exclude

`@Exclude()` lets you exclude properties from a class in a certain
direction. Per default it excludes to export to `*toPlain` and
`*toMongo`. You can also use `@ExcludeToMongo` or `@ExcludeToPlain` to
have more control.

```typescript
class MyEntity {
    @IDType()
    @MongoIdField()
    id: string;
    
    @Exclude()
    internalState: string;
}
```

### ParentReference

`@ParentReference` together with `@Field` is used for all `*ToClass` functions
and allows you to have the parent from instance of class given in `@Field` assigned
as reference. Properties that used `@ParentReference` are automatically excluded
in `*ToPlain` and `*ToMongo` functions.

```typescript
class Page {
    @Field()
    name: string;
    
    @Field([Page])
    children: Page[] = [];
    
    @Field(Page)
    @ParentReference()
    parent?: PageClass;
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

### Decorator

`@Decorator` lets you transform the actual class into something
different. This is useful if you have in the actual class instance
(plainToClass or mongoToClass) a wrapper for a certain property, for
example `string[]` => `ChildrenCollection`.

```typescript
class ChildrenCollection {
    @Decorator()
    @Field([String])
    items: string[];
    
    constructor(items: string[]) {
        this.items = items;
    }
    
    public add(item: string) {
        this.items.push(item);
    }
}

class MyEntity {
    @IDField()
    @MongoIdField()
    id: string;
    
    //in *toMongo and *toPlain is children the value of ChildrenCollection::items
    @Field(ChildrenCollection)
    children: ChildrenCollection = new ChildrenCollection([]);
}
```

`ChildrenCollection` is now always used in *toClass calls. The
constructor of ChildrenCollection receives the actual value as
first argument.

```typescript
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
@ObjectID and @UUID in different way, suitable for Mongo's binary storage.

```typescript
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

## Mongo Database

Marshal's MongoDB database abstraction makes it super easy to
retrieve and store data from and into your MongoDB. We make sure the
data from your JSON or class instance is correctly converted to MongoDB
specific types and inserted IDs are applied to your class instance.

```
npm install @marcj/marshal-mongo
```

```typescript
import {plainToClass} from "@marcj/marshal";
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

const instance: SimpleModel = plainToClass(SimpleModel, {
    id: 'f2ee05ad-ca77-49ea-a571-8f0119e03038',
    name: 'myName',
});

await database.save(SimpleModel, instance);

const list: SimpleModel[] = await database.find(SimpleModel);
const oneItem: SimpleModel = await database.get(
    SimpleModel,
    {id: 'f2ee05ad-ca77-49ea-a571-8f0119e03038'}
);
});
```

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
