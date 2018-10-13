# Marshaller

[![Build Status](https://travis-ci.com/marcj/marshaller.svg?branch=master)](https://travis-ci.com/marcj/marshaller)
[![npm version](https://badge.fury.io/js/marshaller.svg)](https://badge.fury.io/js/marshaller)

Marshaller is a JSON/HTTP-Request serialiser and MongoDB entity manager
for TypeScript and has been built to make data transportation
between HTTP, Node and MongoDB super easy.

![Diagram](https://raw.github.com/marcj/marshaller/master/docs/assets/diagram.png)

## Install

```
npm install marshaller
```

## Example Entity

```typescript
import {
    ClassArray,
    ClassMap,
    DateType,
    Entity,
    ID,
    UUIDType,
    NumberType,
    plainToClass,
    StringType,
    uuid,
} from 'marshaller';


@Entity('sub')
class SubModel {
    @StringType()
    label: string;
}

@Entity('SimpleModel')
class SimpleModel {
    @ID()
    @UUIDType()
    id: string = uuid();

    @StringType()
    name: string;

    @NumberType()
    type: number = 0;

    @DateType()
    created: Date = new Date;

    @ClassArray(SubModel)
    children: SubModel[] = [];

    @ClassMap(SubModel)
    childrenMap: {[key: string]: SubModel} = {};

    constructor(name: string) {
        this.name = name;
    }
}

const instance = plainToClass(SimpleModel, {
    name: 'myName',
    created: 'Sat Oct 13 2018 14:17:35 GMT+0200',
    children: [{label: 'foo'}],
    childrenMap: {'foo': {label: 'foo'}},
});
console.log(instance);
/*
    SimpleModel {
      id: 'f2ee05ad-ca77-49ea-a571-8f0119e03038',
      name: 'myName',
      type: 0,
      plan: 0,
      created: 2018-10-13T17:02:34.456Z,
      children: [ SubModel { label: 'foo' } ],
      childrenMap: { foo: SubModel { label: 'bar' } }
    }
*/
```

## Types

### ID

`@ID()` allows you to define an unique index to your entity. In MongoDB we
store it automatically using Mongo's `ObjectID`. In JSON and JavaScript you
work with it using the string type.


### UUID

`@UUID()` stores a UUID. In TypeScript and JSON it's string, and in MongoDB we
store it automatically using Mongo's `UUID`.

Data types:

| Plain  | Class  | Mongo  |
|:-------|:-------|:-------|
| string | string | UUID() |

### String

`@String()` makes sure the property has always a string type.


Data types:

| JSON   | Class  | Mongo  |
|:-------|:-------|:-------|
| string | string | string |

### Number

`@Number()` makes sure the property has always a number type.


Data types:

| JSON   | Class  | Mongo  |
|:-------|:-------|:-------|
| number | number | number |

### Date

`@Date()` makes sure the property has always a date type. In JSON transport
(using classToPlain, or mongoToPlain) we use strings.

Data types:

| JSON    | Class | Mongo |
|:-------|:------|:------|
| string | Date  | Date  |


### Enum

`@Enum()` makes sure the property has always a valid enum value. In JSON transport
(using classToPlain, or mongoToPlain) we use strings.

Data types:

| JSON   | Class | Mongo  |
|:-------|:------|:-------|
| String | Enum  | String |


### Class

`@Class(ClassDefinition)` makes sure you have in Javascript (plainToClass, or mongoToClass)
always an instance of `ClassDefinition`. In JSON and MongoDB it is stored as plain object.

Data types:

| JSON   | Class | Mongo  |
|:-------|:------|:-------|
| object | class | object |


### ClassArray

`@ClassArray(ClassDefinition)` makes sure you have in Javascript (plainToClass, or mongoToClass)
always an instance of `Array<ClassDefinition>`.
In JSON and MongoDB it is stored as plain array.

Data types:

| JSON  | Class | Mongo |
|:------|:------|:------|
| array | array | array |


### ClassMap

`@ClassMap(ClassDefinition)` makes sure you have in Javascript (plainToClass, or mongoToClass)
always an instance of `{[key: string]: ClassDefinition}`.
In JSON and MongoDB it is stored as plain object.

Data types:

| JSON   | Class  | Mongo  |
|:-------|:-------|:-------|
| object | object | object |


## Database

TypeMapper's MongoDB database abstraction makes it super easy to
retrieve and store data from and into your MongoDB. We make sure the
data from your JSON or class instance is correctly converted to MongoDB
specific types.

Example:

```typescript
import {MongoClient} from "mongodb";
import {Database, plainToClass} from "marshaller";

const connection = await MongoClient.connect(
    'mongodb://localhost:27017', 
    {useNewUrlParser: true}
);
await connection.db('testing').dropDatabase();
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
```


## NestJS / Express


It's super common to accept data from a HTTP-Request, transform the body
into your class instance, work with it, and then store that data in your
MongoDB. With Marshaller this scenario is super simple and you do not
need any manual transformations.


```typescript
import {
    Controller, Get, Param, Post, ValidationPipe,
    Body
} from '@nestjs/common';

import {SimpleModel} from "./tests/entities";
import {plainToClass, Database, classToPlain} from "marshaller";
import {MongoClient} from "mongodb";

@Controller()
class MyController {
    
    private database: Database;
    
    private async getDatabase() {
        if (!this.database) {
            const connection = await MongoClient.connect(
                'mongodb://localhost:27017',
                {useNewUrlParser: true}
            );
            await connection.db('testing').dropDatabase();
            this.database = new Database(connection, 'testing');
        }
        
        return this.database;
    }
    
    @Post('/save')
    async save(
        @Body() body,
    ) {
        const instance: SimpleModel = plainToClass(SimpleModel, body);
        const versionNumber = await this.database.save(SimpleModel, instance);
        
        return instance.id;
    }
    
    @Get('/get/:id')
    async get(@Param('id') id: string) {
        const instance = await this.database.get(SimpleModel, {id: id});
        
        return classToPlain(SimpleModel, instance);
    }
}

````

