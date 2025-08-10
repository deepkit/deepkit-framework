# Deepkit Broker

Deepkit Broker는 message queue, message bus, event bus, pub/sub, key/value store, cache, 그리고 원자적(atomic) 연산을 위한 고성능 추상화입니다. 자동 serialization과 validation, 타입 세이프티, 고성능, 그리고 확장성을 핵심으로 합니다.

Deepkit Broker는 클라이언트이자 서버를 겸합니다. 독립 실행형 서버로도 사용할 수 있고, 다른 Deepkit Broker 서버에 연결하는 클라이언트로도 사용할 수 있습니다. 마이크로서비스 아키텍처에서 사용하도록 설계되었지만, 모놀리식(monolith) 애플리케이션에서도 사용할 수 있습니다.

클라이언트는 다양한 백엔드를 지원하기 위해 adapter 패턴을 사용합니다. 동일한 코드를 서로 다른 백엔드에서 사용할 수 있고, 동시에 여러 백엔드를 사용할 수도 있습니다.

현재 3개의 adapter가 제공됩니다. 하나는 기본 `BrokerDeepkitAdapter`로 Deepkit Broker 서버와 통신하며 Deepkit Broker에 기본 포함되어 있습니다(서버 포함).
두 번째는 Redis 서버와 통신하는 [@deepkit/broker-redis](./package/broker-redis)의 `BrokerRedisAdapter`이며, 세 번째는 테스트 목적의 인메모리 adapter인 `BrokerMemoryAdapter`입니다.

## 설치

Deepkit Framework를 사용할 때는 Deepkit Broker가 기본으로 설치 및 활성화됩니다. 그렇지 않다면 다음으로 설치할 수 있습니다:

```bash
npm install @deepkit/broker
```

## Broker Classes

Deepkit Broker는 다음과 같은 주요 broker 클래스들을 제공합니다:

- **BrokerCache** - 캐시 무효화(invalidation)를 지원하는 L2 캐시 추상화
- **BrokerBus** - Message bus (Pub/Sub)
- **BrokerQueue** - Queue 시스템
- **BrokerLock** - 분산 Lock
- **BrokerKeyValue** - Key/Value store

이 클래스들은 broker 서버와 타입 세이프한 방식으로 통신하기 위해 broker adapter를 받도록 설계되었습니다.

```typescript
import { BrokerBus, BrokerMemoryAdapter } from '@deepkit/broker';

const bus = new BrokerBus(new BrokerMemoryAdapter());
const channel = bus.channel<{ foo: string }>('my-channel-name');
await channel.subscribe((message) => {
  console.log('received message', message);
});

await channel.publish({ foo: 'bar' });
```

FrameworkModule은 기본 adapter를 제공하고 등록하며, 기본적으로 동일한 프로세스에서 실행되는 Deepkit Broker 서버에 연결합니다.

런타임 타입과 `channel<Type>('my-channel-name');` 호출 덕분에 모든 것이 타입 세이프하며, 메시지는 adapter에서 자동으로 validation과 serialization을 수행할 수 있습니다.
기본 구현인 `BrokerDeepkitAdapter`가 이를 자동으로 처리합니다(BSON을 사용하여 serialization).

각 broker 클래스는 자체 adapter interface를 가지고 있으므로, 필요한 Method만 구현할 수 있습니다. `BrokerDeepkitAdapter`는 이 모든 interface를 구현하며 모든 broker API에서 사용할 수 있습니다.

## 애플리케이션 통합

의존성 주입과 함께 Deepkit 애플리케이션에서 이 클래스들을 사용하려면, 다음을 제공하는 `FrameworkModule`을 사용할 수 있습니다:

- broker 서버를 위한 기본 adapter
- broker 서버 자체(자동으로 시작)
- 모든 broker 클래스를 provider로 등록

`FrameworkModule`은 주어진 설정을 기반으로 구성된 broker 서버에 대한 기본 broker adapter를 제공합니다.
또한 모든 broker 클래스에 대한 provider를 등록하므로, 서비스와 provider factory에 이들을 직접 주입할 수 있습니다(예: BrokerBus).

```typescript
// 별도 파일에, 예: broker-channels.ts
type MyBusChannel = BrokerBusChannel<MyMessage>;

const app = new App({
  providers: [
    Service,
    provide<MyBusChannel>((bus: BrokerBus) => bus.channel<MyMessage>('my-channel-name')),
  ],
  imports: [new FrameworkModule({
    broker: {
      // startOnBootstrap이 true이면 broker 서버가 이 주소에서 시작됩니다. Unix 소켓 경로 또는 host:port 조합
      listen: 'localhost:8811', // 또는 'var/broker.sock';
      // 다른 broker 서버를 사용하려면, 이 주소를 지정합니다. Unix 소켓 경로 또는 host:port 조합
      host: 'localhost:8811', // 또는 'var/broker.sock';
      // 메인 프로세스에서 단일 broker를 자동으로 시작합니다. 커스텀 broker 노드가 있다면 비활성화하세요.
      startOnBootstrap: true,
    },
  })],
});
```

이후 서비스에 파생된 broker 클래스들(또는 broker 클래스 자체)을 주입할 수 있습니다:

```typescript
import { MyBusChannel } from './broker-channels.ts';

class Service {
  constructor(private bus: MyBusChannel) {
  }

  async addUser() {
    await this.bus.publish({ foo: 'bar' });
  }
}
```

채널을 위한 파생 타입(위의 `MyBusChannel`처럼)을 만들어 두면 서비스에 쉽게 주입할 수 있어 항상 좋습니다.
그렇지 않다면 `BrokerBus`를 주입하고 사용할 때마다 `channel<MyMessage>('my-channel-name')`를 호출해야 하므로, 오류가 발생하기 쉽고 DRY하지 않습니다.

대부분의 broker 클래스는 이와 같은 방식의 파생을 지원하므로, 한 곳에서 정의해두고 어디서든 사용할 수 있습니다. 자세한 내용은 해당 broker 클래스 문서를 참고하세요.

## 커스텀 Adapter

커스텀 adapter가 필요하다면, `@deepkit/broker`의 다음 interface 중 하나 이상을 구현하여 자체 adapter를 만들 수 있습니다:

```typescript
export type BrokerAdapter = BrokerAdapterCache & BrokerAdapterBus & BrokerAdapterLock & BrokerAdapterQueue & BrokerAdapterKeyValue;
```

```typescript
import { BrokerAdapterBus, BrokerBus, Release } from '@deepkit/broker';
import { Type } from '@deepkit/type';

class MyAdapter implements BrokerAdapterBus {
  disconnect(): Promise<void> {
    // 구현: broker 서버와의 연결 해제
  }
  async publish(name: string, message: any, type: Type): Promise<void> {
    // 구현: broker 서버로 메시지 전송. name은 'my-channel-name', message는 { foo: 'bar' }
  }
  async subscribe(name: string, callback: (message: any) => void, type: Type): Promise<Release> {
    // 구현: broker 서버 구독. name은 'my-channel-name'
  }
}

// 또는 기본 adapter인 BrokerDeepkitAdapter 사용
const adapter = new MyAdapter;
const bus = new BrokerBus(adapter);

```

## Broker 서버

`FrameworkModule`을 임포트하고 `server:start` 명령을 실행하면 Broker 서버가 기본으로 자동 시작됩니다.
모든 Broker 클래스는 기본적으로 이 서버에 연결되도록 구성됩니다.

프로덕션 환경에서는 broker 서버를 별도 프로세스나 다른 머신에서 실행하는 것이 일반적입니다.
`server:start` 대신 `server:broker:start`로 broker 서버를 시작합니다.

트래픽이 많고 확장이 필요하다면, 대신 [redis adapter](./package/broker-redis.md)를 사용하는 것이 좋습니다. Redis 서버를 실행해야 하므로 설정이 더 복잡하지만, 성능이 더 좋고 더 많은 트래픽을 처리할 수 있습니다.

```bash
ts-node app.ts server:broker:start
```

이는 예를 들어 `new FrameworkModule({broker: {listen: 'localhost:8811'}})`로 구성된 호스트에서 서버를 시작합니다.
`app.loadConfigFromEnv({prefix: 'APP_', namingStrategy: 'upper'});`를 활성화했다면 환경 변수로도 주소를 변경할 수 있습니다:

```bash
APP_FRAMEWORK_BROKER_LISTEN=localhost:8811 ts-node app.ts server:broker:start
```

서버를 수동으로 시작하는 경우, 애플리케이션 설정에서 `startOnBootstrap: false`로 자동 broker 서버 시작을 비활성화했는지 확인하세요.