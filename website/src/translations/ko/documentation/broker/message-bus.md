# Broker Bus

Deepkit Message Bus는 애플리케이션의 서로 다른 부분 간에 메시지나 이벤트를 전송할 수 있게 해주는 메시지 버스 시스템(Pub/Sub, 분산 이벤트 시스템)입니다.

마이크로서비스, 모놀리식, 혹은 그 밖의 어떤 형태의 애플리케이션에서도 사용할 수 있습니다. 이벤트 주도 아키텍처에 완벽히 적합합니다.  

이는 프로세스 내 이벤트에 사용하는 Deepkit Event system과는 다릅니다. Broker Bus는 다른 프로세스나 서버로 보내야 하는 이벤트에 사용됩니다. 또한 FrameworkModule이 자동으로 시작한 여러 worker 간 통신이 필요할 때에도 Broker Bus는 매우 적합합니다(예: `new FrameworkModule({workers: 4})`).

이 시스템은 타입 안전성을 염두에 두고 설계되었으며 메시지를 자동으로 직렬화/역직렬화합니다(BSON 사용). 메시지 타입에 [검증](../runtime-types/validation.md)을 추가하면, 전송 전과 수신 후에 메시지를 검증합니다. 이를 통해 메시지가 항상 올바른 형식을 유지하고 기대한 데이터를 포함함을 보장합니다.

## 사용법

```typescript
import { BrokerBus } from '@deepkit/broker';

const bus = new BrokerBus(adapter);

// move this type to a shared file
type UserEvent = { type: 'user-created', id: number } | { type: 'user-deleted', id: number };

const channel = bus.channel<Events>('user-events');

await channel.subscribe((event) => {
  if (event.type === 'user-created') {
    console.log('User created', event.id);
  } else if (event.type === 'user-deleted') {
    console.log('User deleted', event.id);
  }
});

await channel.publish({ type: 'user-created', id: 1 });
```

채널에 이름과 타입을 정의하면 올바른 타입의 메시지만 전송되고 수신되도록 보장할 수 있습니다.
데이터는 자동으로 직렬화/역직렬화됩니다(BSON 사용).

## 앱에서의 사용

애플리케이션에서 BrokerBus를 사용하는 전체 예제입니다.
FrameworkModule을 가져오면 이 클래스는 의존성 주입 컨테이너에서 자동으로 사용할 수 있게 됩니다.
자세한 내용은 시작하기 페이지를 참고하세요.

### Subject

메시지를 전송하고 수신하는 기본 접근 방식은 rxjs `Subject` 타입을 사용하는 것입니다. 그 `subscribe` 및 `next` 메서드는 타입 안전한 방식으로 메시지를 보내고 받도록 해줍니다. 모든 Subject 인스턴스는 브로커에 의해 관리되며, Subject가 가비지 컬렉션되면 브로커 백엔드(예: Redis)에서 구독이 제거됩니다.

메시지 발행 또는 구독 실패를 처리하려면 BrokerBus의 `BusBrokerErrorHandler`를 오버라이드하세요.

이 접근 방식은 비즈니스 코드와 브로커 서버를 깔끔하게 분리해 주며, 브로커 서버 없이도 테스트 환경에서 동일한 코드를 사용할 수 있게 합니다.

```typescript
import { BrokerBus, BrokerBusChannel, provideBusSubject } from '@deepkit/broker';
import { FrameworkModule } from '@deepkit/framework';
import { Subject } from 'rxjs';

// 이 타입은 공유 파일로 이동하세요
type MyChannel = Subject<{
    id: number;
    name: string;
}>;

class Service {
    // MyChannel은 singleton이 아니며, 요청마다 새 인스턴스가 생성됩니다.
    // 그 수명은 프레임워크가 모니터링하며, Subject가 가비지 컬렉션되면 
    // 브로커 백엔드(예: Redis)에서 구독이 제거됩니다.
    constructor(private channel: MyChannel) {
        this.channel.subscribe((message) => {
            console.log('received message', message);
        });
    }

    update() {
        this.channel.next({ id: 1, name: 'Peter' });
    }
}

@rpc.controller('my-controller')
class MyRpcController {
    constructor(private channel: MyChannel) {
    }

    @rpc.action()
    getChannelData(): MyChannel {
        return this.channel;
    }
}

const app = new App({
    controllers: [MyRpcController],
    providers: [
        Service,
        provideBusSubject<MyChannel>('my-channel'),
    ],
    imports: [
        new FrameworkModule(),
    ],
});
```

### BusChannel 

메시지 전송에 대한 확인이 필요하고 각 경우마다 에러를 처리하고 싶다면 `BrokerBusChannel` 타입을 사용할 수 있습니다. `subscribe`와 `publish` 메서드는 Promise를 반환합니다.

```typescript
import { BrokerBus, BrokerBusChannel, provideBusChannel } from '@deepkit/broker';
import { FrameworkModule } from '@deepkit/framework';

// 이 타입은 공유 파일로 이동하세요
type MyChannel = BrokerBusChannel<{
    id: number;
    name: string;
}>;

class Service {
    constructor(private channel: MyChannel) {
        this.channel.subscribe((message) => {
            console.log('received message', message);
        }).catch(e => {
            console.error('Error while subscribing', e);
        });
    }

    async update() {
        await this.channel.publish({ id: 1, name: 'Peter' });
    }
}

const app = new App({
    providers: [
        Service,
        provideBusChannel<MyChannel>('my-channel'),
    ],
    imports: [
        new FrameworkModule(),
    ],
});
```