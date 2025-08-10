# 브로커 Key-Value

Deepkit Broker Key-Value Class는 broker server와 동작하는 간단한 key/value store 추상화입니다. broker server로부터 데이터를 저장하고 가져오는 간단한 방법입니다.

로컬 캐싱은 구현되어 있지 않습니다. 모든 `get` 호출은 매번 브로커 서버로의 실제 네트워크 요청입니다. 이를 피하려면 Broker Cache 추상화를 사용하세요.

데이터는 서버에 영구 저장되지 않고 메모리에만 유지됩니다. 서버가 재시작되면 모든 데이터가 사라집니다.

## 사용법

```typescript
import { BrokerKeyValue } from '@deepkit/broker';

const keyValue = new BrokerKeyValue(adapter, {
  ttl: '60s', // 각 key의 time-to-live. 0은 ttl 없음(기본값).
});

const item = keyValue.item<number>('key1');

await item.set(123);
console.log(await item.get()); //123

await item.remove();
```

데이터는 지정된 Type을 기반으로 BSON을 사용해 자동으로 직렬화/역직렬화됩니다.

`set`과 `get` 메서드는 `BrokerKeyValue` 인스턴스에서 직접 호출할 수도 있지만,
매번 key와 Type을 넘겨야 한다는 단점이 있습니다.

```typescript
await keyValue.set<number>('key1', 123);
console.log(await keyValue.get<number>('key1')); //123
```

## Increment

`increment` Method는 주어진 값만큼 key의 값을 원자적으로 증가시킬 수 있게 해줍니다.

이는 서버에 자체 저장 엔트리를 생성하며 `set` 또는 `get`과 호환되지 않는다는 점에 유의하세요. 

```typescript

const activeUsers = keyValue.item<number>('activeUsers');

// 1씩 원자적으로 증가
await activeUsers.increment(1);

await activeUsers.increment(-1);

// 현재 값을 얻는 유일한 방법은 0으로 increment를 호출하는 것입니다
const current = await activeUsers.increment(0);

// 엔트리를 제거합니다
await activeUsers.remove();
```

## 앱 사용법

애플리케이션에서 BrokerKeyValue를 사용하는 전체 예제입니다.
`FrameworkModule`을 import하면 이 Class는 DI 컨테이너에 자동으로 제공됩니다.
자세한 내용은 Getting Started 페이지를 참조하세요.

```typescript
import { BrokerKeyValue, BrokerKeyValueItem } from '@deepkit/broker';
import { FrameworkModule } from '@deepkit/framework';

// 이 Type을 공유 파일로 이동하세요
type MyKeyValueItem = BrokerKeyValueItem<User[]>;

class Service {
  constructor(private keyValueItem: MyKeyValueItem) {
  }

  async getTopUsers(): Promise<User[]> {
    // undefined일 수 있습니다. 이 경우를 처리해야 합니다.
    // 이를 피하려면 Broker Cache를 사용하세요.
    return await this.keyValueItem.get();
  }
}

const app = new App({
  providers: [
    Service,
    provide<MyKeyValueItem>((keyValue: BrokerKeyValue) => keyValue.item<User[]>('top-users')),
  ],
  imports: [
    new FrameworkModule(),
  ],
});
```