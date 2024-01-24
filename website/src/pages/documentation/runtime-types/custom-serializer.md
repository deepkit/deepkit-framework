# Custom Serializer

By default, `@deepkit/type` comes with a JSON serializer and type validation for TypeScript types. You can extend this and add or remove the serialization functionality or change the way validation is done, as validation is also linked to the serializer.

## New Serializer

A serializer is simply an instance of the `Serializer` class with registered serializer templates. Serializer templates are small functions that create JavaScript code for the JIT serializer process. For each type (String, Number, Boolean, etc.) there is a separate Serializer template that is responsible for returning code for data conversion or validation. This code must be compatible with the JavaScript engine that the user is using.

Only during the execution of the compiler template function do you (or should you) have full access to the full type. The idea is that you should embed all the information needed to convert a type directly into the JavaScript code, resulting in highly optimized code (also called JIT-optimized code).

The following example creates an empty serializer.

```typescript
import { EmptySerializer } from '@deepkit/type';

class User {
  name: string = '';
  created: Date = new Date();
}

const mySerializer = new EmptySerializer('mySerializer');

const user = deserialize<User>({ name: 'Peter', created: 0 }, undefined, mySerializer);
console.log(user);
```

```sh
$ ts-node app.ts
User { name: 'Peter', created: 0 }
```

As you can see, nothing has been converted (`created` is still a number, but we have defined it as `Date`). To change this, we add a serializer template for deserialization of type Date.

```typescript
mySerializer.deserializeRegistry.registerClass(Date, (type, state) => {
  state.addSetter(`new Date(${state.accessor})`);
});

const user = deserialize<User>({ name: 'Peter', created: 0 }, undefined, mySerializer);
console.log(user);
```

```sh
$ ts-node app.ts
User { name: 'Peter', created: 2021-06-10T19:34:27.301Z }
```

Now our serializer converts the value into a Date object.

To do the same for serialization, we register another serialization template.

```typescript
mySerializer.serializeRegistry.registerClass(Date, (type, state) => {
  state.addSetter(`${state.accessor}.toJSON()`);
});

const user1 = new User();
user1.name = 'Peter';
user1.created = new Date('2021-06-10T19:34:27.301Z');
console.log(serialize(user1, undefined, mySerializer));
```

```sh
{ name: 'Peter', created: '2021-06-10T19:34:27.301Z' }
```

Our new serializer now correctly converts the date from the Date object to a string in the serialization process.

## Examples

To see many more examples, you can take a look at the code of the [JSON-Serializers](https://github.com/deepkit/deepkit-framework/blob/master/packages/type/src/serializer.ts#L1688) included in Deepkit Type.

## Extending Existing Serializer

If you want to extend an existing serializer, you can do so using class inheritance. This works because serializers should be written to register their templates in the constructor.

```typescript
class MySerializer extends Serializer {
  constructor(name: string = 'mySerializer') {
    super(name);
    this.registerTemplates();
  }

  protected registerTemplates() {
    this.deserializeRegistry.register(ReflectionKind.string, (type, state) => {
      state.addSetter(`String(${state.accessor})`);
    });

    this.deserializeRegistry.registerClass(Date, (type, state) => {
      state.addSetter(`new Date(${state.accessor})`);
    });

    this.serializeRegistry.registerClass(Date, (type, state) => {
      state.addSetter(`${state.accessor}.toJSON()`);
    });
  }
}
const mySerializer = new MySerializer();
```
