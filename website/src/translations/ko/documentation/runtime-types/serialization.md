# 직렬화

Serialization은 예를 들어 데이터 타입을 전송 또는 저장에 적합한 형식으로 변환하는 과정입니다. Deserialization은 이를 되돌리는 과정입니다. 이 과정은 무손실로 수행되어, 데이터 타입 정보나 데이터 자체를 잃지 않고 직렬화 대상과 상호 변환할 수 있습니다.

JavaScript에서 직렬화는 보통 JavaScript 객체와 JSON 사이에서 이루어집니다. JSON은 String, Number, Boolean, Object, Array만을 지원합니다. 반면 JavaScript는 BigInt, ArrayBuffer, typed arrays, Date, 사용자 정의 class 인스턴스 등 훨씬 많은 타입을 지원합니다. JavaScript 데이터를 JSON으로 서버에 전송하려면 클라이언트 측의 직렬화 과정과 서버 측의 역직렬화 과정이 필요하며, 반대로 서버가 JSON으로 데이터를 클라이언트에 보낼 때도 마찬가지입니다. 이때 `JSON.parse`와 `JSON.stringify`만으로는 무손실이 아니기 때문에 충분하지 않은 경우가 많습니다.

이 직렬화 과정은 비사소한 데이터에 필수적입니다. JSON은 심지어 date 같은 기본 타입의 정보도 잃어버리기 때문입니다. 새 Date는 결국 JSON에서 문자열로 직렬화됩니다:

```typescript
const json = JSON.stringify(new Date);
//'"2022-05-13T20:48:51.025Z"
```

보시다시피 JSON.stringify의 결과는 JSON 문자열입니다. 이를 다시 JSON.parse로 역직렬화하면 date 객체가 아니라 문자열을 얻게 됩니다.

```typescript
const value = JSON.parse('"2022-05-13T20:48:51.025Z"');
//"2022-05-13T20:48:51.025Z"
```

JSON.parse에 Date 객체의 역직렬화를 가르치는 다양한 우회 방법이 있지만, 오류가 발생하기 쉽고 성능이 좋지 않습니다. 이 경우 및 많은 다른 타입에 대해 타입 안전한 직렬화와 역직렬화를 가능하게 하려면 별도의 직렬화 과정이 필요합니다.

네 가지 주요 Function이 제공됩니다: `serialize`, `cast`, `deserialize`, `validatedDeserialize`. 이러한 Function의 내부에서는 기본적으로 `@deepkit/type`의 전역 JSON serializer가 사용되지만, 사용자 정의 직렬화 대상도 사용할 수 있습니다.

Deepkit Type은 사용자 정의 직렬화 대상을 지원하며, 이미 강력한 JSON 직렬화 대상을 제공하여 데이터를 JSON 객체로 직렬화하고 `JSON.stringify`를 사용해 JSON으로 올바르고 안전하게 변환할 수 있습니다. `@deepkit/bson`을 사용하면 BSON도 직렬화 대상으로 사용할 수 있습니다. 사용자 정의 직렬화 대상(예: 데이터베이스 드라이버용)을 만드는 방법은 Custom Serializer 섹션에서 배울 수 있습니다.

serializer도 호환성 검증을 수행하지만, 이러한 검증은 [검증](validation.md)의 검증과는 다릅니다. 오직 `cast` Function만이 역직렬화가 성공한 후 [검증](validation.md) 챕터의 전체 검증 프로세스를 호출하며, 데이터가 유효하지 않으면 Error를 던집니다.

대안으로, 역직렬화 후 검증을 수행하기 위해 `validatedDeserialize`를 사용할 수 있습니다. 또 다른 대안으로는 `deserialize` Function으로 역직렬화한 데이터에 `validate` 또는 `validates` Function을 수동으로 호출하는 방법이 있습니다. 자세한 내용은 [검증](validation.md)을 참고하세요.

직렬화와 검증의 모든 Function은 오류 시 `@deepkit/type`의 `ValidationError`를 던집니다.

## Cast

`cast` Function은 첫 타입 인수로 TypeScript 타입을, 두 번째 인수로 변환할 데이터를 받습니다. 데이터는 주어진 타입으로 캐스팅되며, 성공 시 그 데이터가 반환됩니다. 데이터가 주어진 타입과 호환되지 않고 자동 변환할 수 없으면 `ValidationError`가 던져집니다.

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
    created: Date = new Date;

    constructor(public name: string) {
    }
}

const myModel = cast<MyModel>({
    id: 5,
    created: 'Sat Oct 13 2018 14:17:35 GMT+0200',
    name: 'Peter',
});
```

`deserialize` Function은 `cast`와 유사하지만, 데이터가 주어진 타입과 호환되지 않을 때 Error를 던지지 않습니다. 대신 가능한 한 변환을 시도하고 그 결과를 반환합니다. 데이터가 주어진 타입과 호환되지 않으면 원본 데이터를 그대로 반환합니다.

## 직렬화

```typescript
import { serialize } from '@deepkit/type';

class MyModel {
    id: number = 0;
    created: Date = new Date;

    constructor(public name: string) {
    }
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

`serialize` Function은 기본적으로 JSON serializer를 사용해 전달된 데이터를 JSON 객체, 즉 String, Number, Boolean, Object, 또는 Array로 변환합니다. 이 결과는 `JSON.stringify`를 사용해 안전하게 JSON으로 변환할 수 있습니다.

## 역직렬화

`deserialize` Function은 기본적으로 JSON serializer를 사용해 전달된 데이터를 지정된 타입으로 변환합니다. JSON serializer는 JSON 객체, 즉 string, number, boolean, object, 또는 array를 입력으로 기대합니다. 이는 보통 `JSON.parse` 호출에서 얻습니다.

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

이미 올바른 데이터 타입이 전달된 경우(예: `created`에 Date 객체)에는 그대로 사용됩니다.

class뿐 아니라 어떤 TypeScript 타입이든 첫 타입 인수로 지정할 수 있습니다. 따라서 원시 타입이나 매우 복잡한 타입도 전달할 수 있습니다:

```typescript
deserialize<Date>('Sat Oct 13 2018 14:17:35 GMT+0200');
deserialize<string | number>(23);
```

<a name="loosely-convertion"></a>
### 느슨한 타입 변환

역직렬화 과정에는 느슨한 타입 변환이 구현되어 있습니다. 이는 String 타입에 대해 String과 Number를, 혹은 String 타입을 위해 Number를 받아 자동으로 변환할 수 있음을 의미합니다. 이는 예를 들어 URL을 통해 데이터를 받고 역직렬화기에 전달할 때 유용합니다. URL은 항상 문자열이므로, Deepkit Type은 Number와 Boolean 타입을 여전히 해석하려고 시도합니다.

```typescript
deserialize<boolean>('false')); //false
deserialize<boolean>('0')); //false
deserialize<boolean>('1')); //true

deserialize<number>('1')); //1

deserialize<string>(1)); //'1'
```

다음과 같은 느슨한 타입 변환이 JSON serializer에 내장되어 있습니다:

* number|bigint: Number 또는 Bigint는 String, Number, BigInt를 허용합니다. 변환이 필요할 경우 `parseFloat` 또는 `BigInt(x)`가 사용됩니다.
* boolean: Boolean은 Number와 String을 허용합니다. 0, '0', 'false'는 `false`로 해석되고, 1, '1', 'true'는 `true`로 해석됩니다.
* string: String은 Number, String, Boolean 등 많은 값을 허용합니다. 문자열이 아닌 값은 모두 `String(x)`로 자동 변환됩니다.

느슨한 변환은 비활성화할 수도 있습니다:

```typescript
const result = deserialize(data, {loosely: false});
```

유효하지 않은 데이터의 경우 변환을 시도하지 않고 대신 Error가 던져집니다.