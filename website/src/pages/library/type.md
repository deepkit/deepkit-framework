---
title: Deepkit Runtime Types
package: "@deepkit/type"
doc: runtime-types/getting-started
api: type
category: runtime-types
---

<p class="introduction">
Rich runtime type system for TypeScript with reflection, serialization, validation, and many more features.
Works in any JavaScript runtime without code generation step.<br/>
Plugins available for TypeScript official compiler <code>tsc</code>, Vite, Bun, and Webpack.
</p>


## Features

<div class="app-boxes-small">
    <box title="Runtime Types">Makes TypeScript types available in any JavaScript runtime.</box>
    <box title="Validation">With powerful validation of your TypeScript types, without code-generation step.</box>
    <box title="Serialisation">Fast and flexible serialisation from and to JSON, database, BSON, and more.</box>
    <box title="Reflection">Introspect all types via standardised in runtime and unlock TypeScript at runtime.</box>
    <box title="Automatic Type-Guards">Type-Guards and Type-Assertions in runtime, automatically from your types.</box>
    <box title="Highly Customizable">Add your own custom type annotation, serializers, naming strategies, and more.</box>
</div>

<feature>

## Runtime TypeScript Types

Deepkit Type provides a rich runtime type system for TypeScript. It allows you to use your TypeScript types in any JavaScript runtime, like Node.js, Deno, or the browser.

```typescript
import { MinLength, stringifyResolvedType, 
    typeOf } from '@deepkit/type';

type Username = string & MinLength<3>;

interface User {
    username: Username;
    password: string;
    created: Date;
}

const type = typeOf<User>();
console.log('Type introspection', type);
console.log('Type stringify', stringifyResolvedType(type));
```
</feature>

<feature class="right">

## Type Cast

Real type casting in runtime for TypeScript. This is not a type assertion, but a real type cast. It converts the value to the correct type.

Whenever you load data from a database, HTTP request, JSON, or any other source, you can use `cast` to convert the data to the correct type.

```typescript
import { cast } from '@deepkit/type';

interface User {
    username: string;
    logins: number;
    created: Date;
}

// converts all values to the correct type
const user = cast<User>({
    username: 'Peter',
    logins: '3',
    created: '2020-01-01'
});
```
</feature>

<feature>

## Reflection API

Easy to use reflection API to introspect your types. This is especially useful for building generic libraries that work with any TypeScript type.

With the reflection API you can get all properties of classes, interfaces, or functions, properties, all methods, their parameters, and more.

```typescript
import { ReflectionClass } from '@deepkit/type';

class User {
    logins: number = 1;
    created: Date = new Date;

    constructor(public username: string) {
    }
}

const reflection = ReflectionClass.from(User);

reflection.getMethodParameters('constructor');
for (const p of reflection.getProperties()) {
    p.name;
    p.type;
    p.isOptional();
    p.getVisibility();
}
```
</feature>


<feature class="right">

## Serialization

Serialize data to JSON, BSON, or any other format. The serialization is very fast and flexible. You can use it to serialize data for HTTP responses, databases, queues, files, or any other use case.

Highly configurable and extensible. You can add your own custom types, custom serializers, custom naming strategy, and more.

Use `serialize` to convert your data to a plain JavaScript object, and `cast` to convert it back.

```typescript
import { serialize, cast } from '@deepkit/type';

interface User {
    username: string;
    logins: number;
    created: Date;
}

// jsonObject is a plain JavaScript object
// and ready for transport via JSON.stringify
const jsonObject = serialize<User>({
    username: 'Peter',
    logins: 3,
    created: new Date,
});

// convert back from transport to real JavaScript types
const user = cast<User>(jsonObject);
```
</feature>


<feature>

## Type Object Serialization

Deepkit Type provides a special serialization format for TypeScript types. This is useful if you want to send your TypeScript types to another JavaScript runtime, like the browser, or a Node.js worker.

This makes it possible to store the inherently circular TypeScript type object in a JSON.

```typescript
import { serializeType, deserializeType, 
    cast } from '@deepkit/type';

interface User {
    username: string;
    logins: number;
    created: Date;
}

// typeObject is ready for transport via JSON.stringify
const typeObject = serializeType(typeOf<User>());

// convert back from transport to Deepkit's circular type object
const type = deserializeType(typeObject);

// and use it in cast/deserialize/validate, etc
const o = cast(data, undefined, undefined, undefined, type);
```
</feature>


<feature class="right">

## Remapping

As a data mapper, Deepkit Type can convert your data from one shape to another.

Support for custom naming strategies. You can use this to convert your property names to camelCase, snake_case, or any other naming strategy.


```typescript
import { cast, MapName,
    underscoreNamingStrategy} from '@deepkit/type';

interface User {
    username: string;
    firstName: string;
    group: string & MapName<'group_id'>;
}

const jsonObject = {
    username: 'pete',
    first_name: 'Peter',
    group_id: 'admin'
};

// user has the shape of User
const user = cast<User>(data, undefined, 
    undefined, underscoreNamingStrategy);
```
</feature>


<feature>

## Type Guards

TypeScript type guards in runtime. Whenever you accept untrusted data or `any`, you can use `is` to check if the data is of a specific type.

Type Assertion with `assert` to check the data and throw an error if it is not of the expected type.

```typescript
import { is, assert} from '@deepkit/type';

interface User {
    username: string;
    firstName: string;
    group: string & MapName<'group_id'>;
}

const user = await fetch('/user/1');
if (is<User>(user)) {
    // user object has been validated and its safe
    user.username;
}

// throws an error if user is not of type User
assert<User>(user);
```
</feature>
