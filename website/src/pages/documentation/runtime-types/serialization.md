# Serialisation

Serialization is the process of converting data types into a format suitable for transport or storage, for example. Deserialization is the process of undoing this. This is done loss-lessly, meaning that data can be converted to and from a serialization target without losing data type information or the data itself.

In JavaScript, serialization is usually between JavaScript objects and JSON. JSON supports only String, Number, Boolean, Objects, and Arrays. JavaScript, on the other hand, supports many other types such as BigInt, ArrayBuffer, typed arrays, Date, custom class instances, and many more. Now, to transmit JavaScript data to a server using JSON, you need a serialization process (on the client) and a deserialization process (on the server), or vice versa if the server sends data to the client as JSON. Using `JSON.parse` and `JSON.stringify` is often not sufficient for this, as it is not lossless.

This serialization process is absolutely necessary for non-trivial data, since JSON loses its information even for basic types like a date. A new Date is finally serialized as a string in JSON:

```typescript
const json = JSON.stringify(new Date());
//'"2022-05-13T20:48:51.025Z"
```

As you can see, the result of JSON.stringify is a JSON string. If you deserialize it again with JSON.parse, you will not get a date object, but a string.

```typescript
const value = JSON.parse('"2022-05-13T20:48:51.025Z"');
//"2022-05-13T20:48:51.025Z"
```

Although there are various workarounds to teach JSON.parse to deserialize Date objects, they are error-prone and poorly performing. To enable typesafe serialization and deserialization for this case and many other types, a serialization process is necessary.

There are four main functions available: `serialize`, `cast`, `deserialize` and `validatedDeserialize`. Under the hood of these functions, the globally available JSON serializer from `@deepkit/type` is used by default, but a custom serialization target can also be used.

Deepkit Type supports user-defined serialization targets, but already comes with a powerful JSON serialization target that serializes data as JSON objects and then can be correctly and safely converted as JSON using JSON.stringify. With `@deepkit/bson`, BSON can also be used as a serialization target. How to create a custom serialization target (for example for a database driver) can be learned in the Custom Serializer section.

Note that although serializers also validate data for compatibility, these validations are different from the validation in [Validation](validation.md). Only the `cast` function also calls the full validation process from the [Validation](validation.md) chapter after successful deserialization, and throws an error if the data is not valid.

Alternatively, `validatedDeserialize` can be used to validate after deserialization. Another alternative is to manually call the `validate` or `validates` functions on deserialized data from the `deserialize` function, see [Validation](validation.md).

All functions from serialization and validation throw a `ValidationError` from `@deepkit/type` on errors.

## Cast

The `cast` function expects as first type argument a TypeScript type, and as second argument the data to cast. The data is casted to the given type, and if successful, the data is returned. If the data is not compatible with the given type and can not be converted automatically, a `ValidationError` is thrown.

```typescript
import { cast } from '@deepkit/type';

cast<string>(123); //'123'
cast<number>('123'); //123
cast<number>('asdasd'); // throws ValidationError

cast<string | number>(123); //123
```

```typescript
class MyModel {
  id: number = 0;
  created: Date = new Date();

  constructor(public name: string) {}
}

const myModel = cast<MyModel>({
  id: 5,
  created: 'Sat Oct 13 2018 14:17:35 GMT+0200',
  name: 'Peter',
});
```

The `deserialize` function is similar to `cast`, but does not throw an error if the data is not compatible with the given type. Instead, the data is converted as far as possible and the result is returned. If the data is not compatible with the given type, the data is returned as it is.

## Serialization

```typescript
import { serialize } from '@deepkit/type';

class MyModel {
  id: number = 0;
  created: Date = new Date();

  constructor(public name: string) {}
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

The function `serialize` converts the passed data by default with the JSON serializer into a JSON object, that is: String, Number, Boolean, Object, or Array. The result of this can then be safely converted to a JSON using `JSON.stringify`.

## Deserialiazation

The function `deserialize` converts the passed data per default with the JSON serializer into the corresponding specified types. The JSON serializer expects a JSON object, i.e.: string, number, boolean, object, or array. This is usually obtained from a `JSON.parse` call.

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

//from JSON
const json = '{"id": 5, "created": "Sat Oct 13 2018 14:17:35 GMT+0200", "name": "Peter"}';
const myModel = deserialize<MyModel>(JSON.parse(json));
```

If the correct data type is already passed (for example, a Date object in the case of `created`), then this is taken as it is.

Not only a class, but any TypeScript type can be specified as the first type argument. So even primitives or very complex types can be passed:

```typescript
deserialize<Date>('Sat Oct 13 2018 14:17:35 GMT+0200');
deserialize<string | number>(23);
```

<a name="loosely-convertion"></a>

### Soft Type Conversion

In the deserialization process a soft type conversion is implemented. This means that String and Number for String types or a Number for a String type can be accepted and converted automatically. This is useful, for example, when data is accepted via a URL and passed to the deserializer. Since the URL is always a string, Deepkit Type still tries to resolve the types for Number and Boolean.

```typescript
deserialize<boolean>('false')); //false
deserialize<boolean>('0')); //false
deserialize<boolean>('1')); //true

deserialize<number>('1')); //1

deserialize<string>(1)); //'1'
```

The following soft type conversions are built into the JSON serializer:

- _number|bigint_: Number or Bigint accept String, Number, and BigInt. `parseFloat` or `BigInt(x)` are used in case of a necessary conversion.
- _boolean_: Boolean accepts Number and String. 0, '0', 'false' is interpreted as `false`. 1, '1', 'true' is interpreted as `true`.
- _string_: String accepts Number, String, Boolean, and many more. All non-string values are automatically converted with `String(x)`.

The soft conversion can also be deactivated:

```typescript
const result = deserialize(data, { loosely: false });
```

In the case of invalid data, no attempt is made to convert it and instead an error message is thrown.

## Type Annotations

### Integer

### Group

### Excluded

### Mapped

### Embedded

## Naming Strategy
