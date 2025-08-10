# 自定义序列化器

默认情况下，`@deepkit/type` 自带 JSON 序列化器以及对 TypeScript 类型的类型校验。你可以扩展它，添加或移除序列化功能，或改变校验的方式，因为校验同样与序列化器相关联。

## 新建序列化器

序列化器只是一个带有已注册序列化模板的 `Serializer` 类实例。序列化模板是为 JIT 序列化过程生成 JavaScript 代码的小函数。对于每种类型（String、Number、Boolean 等），都有一个单独的序列化器模板，负责返回用于数据转换或校验的代码。该代码必须与用户使用的 JavaScript 引擎兼容。

只有在模板函数执行期间，你（或者说应当）才能完全访问到该类型的完整信息。其理念是将类型转换所需的全部信息直接嵌入到生成的 JavaScript 代码中，从而得到高度优化的代码（也称为 JIT 优化代码）。

下面的示例创建一个空的序列化器。

```typescript
import { EmptySerializer } from '@deepkit/type';

class User {
    name: string = '';
    created: Date = new Date;
}

const mySerializer = new EmptySerializer('mySerializer');

const user = deserialize<User>({ name: 'Peter', created: 0 }, undefined, mySerializer);
console.log(user);
```

```sh
$ ts-node app.ts
User { name: 'Peter', created: 0 }
```

如你所见，没有发生任何转换（`created` 仍然是数字，但我们将其定义为 `Date`）。要改变这一点，我们为 Date 类型的反序列化注册一个序列化器模板。

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

现在我们的序列化器会将该值转换为 Date 对象。

要在序列化时做同样的事，我们再注册一个序列化模板。

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

我们新的序列化器现在会在序列化过程中正确地将 Date 对象的日期转换为字符串。

## 示例

想查看更多示例，可以看看 Deepkit Type 中包含的[JSON 序列化器](https://github.com/deepkit/deepkit-framework/blob/master/packages/type/src/serializer.ts#L1688)的代码。

## 扩展现有序列化器

如果你想扩展一个现有的序列化器，可以使用类继承。这之所以可行，是因为序列化器应当在构造函数中注册它们的模板。

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