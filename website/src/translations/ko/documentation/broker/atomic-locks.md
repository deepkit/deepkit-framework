# Broker 원자적 Lock

Deepkit Broker Locks는 여러 프로세스나 머신 전반에서 원자적 lock을 생성하는 간단한 방법입니다. 

동시에 오직 하나의 프로세스만 특정 코드 블록을 실행하도록 보장하는 간단한 방법입니다.

## 사용법

```typescript
import { BrokerLock } from '@deepkit/broker';

const lock = new BrokerLock(adapter);

// lock은 60초 동안 유효합니다.
// 획득 timeout은 10초입니다.
const myLock = lock.item('my-lock', { ttl: '60s', timeout: '10s' });

async function criticalSection() {
  // 함수가 끝날 때까지 lock을 유지합니다.
  // 함수가 에러를 던져도 lock을 자동으로 정리합니다.
  await using hold = await lock1.hold();
}
```

이 lock은 [명시적 리소스 관리](https://github.com/tc39/proposal-explicit-resource-management)를 지원하므로, lock을 제대로 해제하기 위해 try-catch 블록을 사용할 필요가 없습니다.

lock을 수동으로 획득하고 해제하려면 `acquire` 및 `release` 메서드를 사용할 수 있습니다.

```typescript
// lock을 획득할 때까지 대기합니다.
// 또는 timeout에 도달하면 예외를 던집니다
await myLock.acquire();

try {
  // 중요한 작업 수행
} finally {
  await myLock.release();
}
```

## 앱에서의 사용

애플리케이션에서 BrokerLock을 사용하는 전체 예제입니다.
`FrameworkModule`을 import하면 이 Class는 의존성 주입 컨테이너에서 자동으로 사용 가능합니다.
자세한 내용은 Getting started 페이지를 참고하세요.

```typescript
import { BrokerLock, BrokerLockItem } from '@deepkit/broker';
import { FrameworkModule } from '@deepkit/framework';

// 이 Type을 공유 파일로 이동하세요
type MyCriticalLock = BrokerLockItem;

class Service {
  constructor(private criticalLock: MyCriticalLock) {
  }

  async doSomethingCritical() {
    await using hold = await this.criticalLock.hold();
    
    // 중요한 작업 수행,
    // lock은 자동으로 해제됩니다
  }
}

const app = new App({
  providers: [
    Service,
    provide<MyCriticalLock>((lock: BrokerLock) => lock.item('my-critical-lock', { ttl: '60s', timeout: '10s' })),
  ],
  imports: [
    new FrameworkModule(),
  ],
});
```