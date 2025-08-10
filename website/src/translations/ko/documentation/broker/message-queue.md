# Broker Queue

Deepkit Message Queue는 메시지를 큐 서버로 전송하고 워커가 이를 처리할 수 있게 해주는 메시지 큐 시스템입니다.

이 시스템은 type-safe하도록 설계되어 있으며 메시지를 자동으로 직렬화/역직렬화합니다(BSON 사용).

데이터는 서버에 영구 저장되므로 서버가 크래시하더라도 데이터가 유실되지 않습니다.

## 사용법

```typescript
import { BrokerQueue, BrokerQueueChannel } from '@deepkit/broker';

const queue = new BrokerQueue(adapter);

type User = { id: number, username: string };

const registrationChannel = queue.channel<User>('user/registered', {
  process: QueueMessageProcessing.exactlyOnce,
  deduplicationInterval: '1s',
});

// 워커가 메시지를 소비합니다.
// 일반적으로 별도의 프로세스에서 수행됩니다.
await registrationChannel.consume(async (user) => {
  console.log('User registered', user);
  // 워커가 여기서 크래시하더라도 메시지는 유실되지 않습니다.
  // 다른 워커에게 자동으로 다시 전달됩니다.
  // 이 콜백이 에러 없이 반환되면, 
  // 메시지는 처리 완료로 표시되고 결국 제거됩니다.
});

// 메시지를 전송하는 애플리케이션
await registrationChannel.produce({ id: 1, username: 'Peter' });
```

## 앱 사용법

애플리케이션에서 BrokerQueue를 사용하는 전체 예시입니다.
`FrameworkModule`를 임포트하면 해당 Class는 의존성 주입 컨테이너에서 자동으로 사용 가능합니다.
자세한 내용은 Getting started 페이지를 참조하세요.

큐 시스템을 최대한 활용하려면 메시지를 소비하는 여러 워커를 실행하는 것이 좋습니다.
http 라우트 등을 가진 메인 애플리케이션과는 별도의 `App`을 작성합니다.

공통 Service는 공유 앱 모듈을 통해 공유합니다. Channel 정의는 애플리케이션 전반에서 공용 파일을 통해 공유합니다.

```typescript
// file: channels.ts

export type RegistrationChannel = BrokerQueueChannel<User>;
export const registrationChannelProvider = provide<RegistrationChannel>((queue: BrokerQueue) => queue.channel<User>('user/registered', {
  process: QueueMessageProcessing.exactlyOnce,
  deduplicationInterval: '1s',
}));
```

```typescript
// file: worker.ts
import { RegistrationChannel, registrationChannelProvider } from './channels';

async function consumerCommand(
  channel: RegistrationChannel, 
  database: Database) {

  await channel.consume(async (user) => {
    // user로 무언가를 수행하고,
    // 정보를 저장하거나 이메일을 보내는 등 작업을 수행합니다.
  });

  // broker에 대한 연결이 프로세스를 유지합니다.
}

const app = new App({
  providers: [
    Database,
    registrationChannelProvider,
  ],
  imports: [
    new FrameworkModule({}),
  ],
});

app.command('consumer', consumerCommand);

// 위의 worker 커맨드를 직접 시작합니다
void app.run('consumer');
```

그리고 애플리케이션에서는 다음과 같이 메시지를 생성(produce)합니다:

```typescript
// file: app.ts
import { RegistrationChannel, registrationChannelProvider } from './channels';

class Service {
  constructor(private channel: RegistrationChannel) {
  }

  async registerUser(user: User) {
    await this.channel.produce(user);
  }
}

const app = new App({
  providers: [
    Service,
    registrationChannelProvider,
  ],
  imports: [
    new FrameworkModule({}),
  ],
});

void app.run();
```