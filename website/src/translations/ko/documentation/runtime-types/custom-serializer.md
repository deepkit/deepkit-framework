# Custom Serializer

기본적으로 `@deepkit/type`는 JSON serializer와 TypeScript 타입을 위한 type validation을 제공합니다. 이를 확장하여 serialization 기능을 추가/제거하거나 validation 방식(validator가 serializer와도 연결되어 있음)을 변경할 수 있습니다.

## New Serializer

serializer는 등록된 serializer templates와 함께 `Serializer` Class의 인스턴스일 뿐입니다. serializer template은 JIT serializer process를 위해 JavaScript 코드를 생성하는 작은 Function입니다. 각 Type(String, Number, Boolean 등)마다 데이터 변환 또는 validation을 위한 코드를 반환하는 별도의 serializer template이 있습니다. 이 코드는 사용자가 사용하는 JavaScript 엔진과 호환되어야 합니다.

컴파일러 template Function이 실행되는 동안에만(또는 그렇게 되어야만) 전체 Type에 완전히 접근할 수 있습니다. 아이디어는 타입 변환에 필요한 모든 정보를 JavaScript 코드에 직접 포함시켜 매우 최적화된 코드(JIT-optimized code라고도 함)를 생성하는 것입니다.

다음 예시는 빈 serializer를 생성합니다.

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

보시다시피 아무 것도 변환되지 않았습니다(`created`는 여전히 number이지만, 우리는 이를 `Date`로 정의했습니다). 이를 변경하기 위해, Date Type의 deserialization을 위한 serializer template을 추가합니다.

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

이제 우리의 serializer는 값을 Date Object로 변환합니다.

serialization에도 동일하게 하려면, 또 다른 serialization template을 등록합니다.

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

새 serializer는 이제 serialization 과정에서 Date Object의 날짜를 문자열로 올바르게 변환합니다.

## Examples

더 많은 예시를 보려면 Deepkit Type에 포함된 [JSON Serializer들](https://github.com/deepkit/deepkit-framework/blob/master/packages/type/src/serializer.ts#L1688)의 코드를 살펴보세요.

## Extending Existing Serializer

기존 serializer를 확장하고 싶다면 class 상속을 사용하면 됩니다. 이는 serializer가 constructor에서 자신의 template을 등록하도록 작성되어야 하기 때문에 가능합니다.

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