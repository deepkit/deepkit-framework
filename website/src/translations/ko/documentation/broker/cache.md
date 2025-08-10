# 브로커 캐시

Deepkit Broker Cache Class는 메모리에 휘발성 로컬 캐시를 유지하는 2단계(2 levels) 캐시로, 데이터가 캐시에 없거나 만료되었거나 무효화된 경우에만 브로커 서버에서 데이터를 가져옵니다. 이를 통해 매우 높은 성능과 낮은 지연으로 데이터를 가져올 수 있습니다.

이 캐시는 type-safe하도록 설계되었으며 데이터는 자동으로 직렬화/역직렬화(BSON 사용)됩니다. 또한 캐시 무효화와 캐시 초기화를 지원합니다. 구현은 동일한 캐시 아이템에 동시에 여러 요청이 접근하더라도 프로세스당 캐시가 한 번만 재구성되도록 보장합니다.

데이터는 서버에 영구 저장되지 않고 메모리에만 유지됩니다. 서버가 재시작되면 모든 데이터가 유실됩니다.

## 사용법

BrokerCache가 의존성 주입 컨테이너에서 사용 가능하도록 애플리케이션을 올바르게 설정하는 방법은 시작하기 페이지를 확인하세요.

Deepkit Broker의 캐시 추상화는 단순한 key/value store와 매우 다릅니다. 캐시 이름과 캐시가 비어 있거나 만료되었을 때 자동으로 호출되는 builder Function을 정의하는 방식으로 동작합니다. 이 builder Function은 캐시에 저장될 데이터를 생성하는 역할을 합니다.

```typescript
import { BrokerCache, BrokerCacheItem } from '@deepkit/broker';

const cache = new BrokerCache(adapter);

const cacheItem = cache.item('my-cache', async () => {
  // 이것은 캐시가 비어 있거나 만료되었을 때 호출되는 builder Function입니다
  return 'hello world';
});


// 캐시가 만료되었거나 비어 있는지 확인
await cacheItem.exists();

// 캐시에서 데이터를 가져오거나 브로커 서버에서 가져옵니다
// 캐시가 비어 있거나 만료된 경우 builder Function이 호출되고
// 결과가 반환되며 브로커 서버로 전송됩니다.
const topUsers = await cacheItem.get();

// 캐시를 무효화하여 다음 get() 호출 시 
// 다시 builder Function이 호출되도록 합니다.
// 로컬 캐시와 서버 캐시를 모두 지웁니다.
await cacheItem.invalidate();

// 캐시에 데이터를 수동으로 설정
await cacheItem.set(xy);
```

## 앱에서의 사용

애플리케이션에서 BrokerCache를 사용하는 전체 예제입니다.
`FrameworkModule`을 임포트하면 해당 Class는 의존성 주입 컨테이너에서 자동으로 사용 가능합니다.
자세한 내용은 시작하기 페이지를 참고하세요.

```typescript
import { BrokerCache, BrokerCacheItem } from '@deepkit/broker';
import { FrameworkModule } from '@deepkit/framework';

// 이러한 타입을 공통 파일에 정의해 두면 재사용하기 좋고
// 서비스에 주입하기도 용이합니다
type MyCacheItem = BrokerCacheItem<User[]>;

function createMyCache(cache: BrokerCache, database: Database) {
  return cache.item<User[]>('top-users', async () => {
    // 이것은 캐시가 비어 있거나 만료되었을 때 호출되는 builder Function입니다
    return await database.query(User)
      .limit(10).orderBy('score').find();
  });
}

class Service {
  constructor(private cacheItem: MyCacheItem) {
  }

  async getTopUsers() {
    return await this.cacheItem.get();
  }
}

const app = new App({
  providers: [
    Service,
    Database,
    provide<MyCacheItem>(createMyCache),
  ],
  imports: [
    new FrameworkModule(),
  ],
});

const cacheItem = app.get<MyCacheItem>();

// 캐시에서 데이터를 가져오거나 브로커 서버에서 가져옵니다
const topUsers = await cacheItem.get();
```