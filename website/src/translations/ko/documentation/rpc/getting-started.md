# 시작하기

Deepkit RPC를 사용하려면 Runtime Types에 기반하므로 `@deepkit/type`가 올바르게 설치되어 있어야 합니다. [Runtime Type 설치](../runtime-types.md)를 참고하세요.

이 작업이 성공적으로 완료되면, 라이브러리를 내부적으로 이미 사용하는 Deepkit Framework 또는 `@deepkit/rpc`를 설치할 수 있습니다.

```sh
npm install @deepkit/rpc
```

`@deepkit/rpc`의 Controller Class는 TypeScript decorator에 기반하며, 이 기능을 사용하려면 experimentalDecorators를 활성화해야 합니다.

서버와 클라이언트가 각각의 package.json을 가지고 있다면 `@deepkit/rpc` 패키지는 서버와 클라이언트 모두에 설치해야 합니다.

서버와 TCP로 통신하려면 클라이언트와 서버에 `@deepkit/rpc-tcp` 패키지를 설치해야 합니다.

```sh
npm install @deepkit/rpc-tcp
```

WebSocket 통신의 경우에도 서버에는 이 패키지가 필요합니다. 반면 브라우저의 클라이언트는 표준 WebSocket을 사용합니다.

클라이언트를 WebSocket이 없는 환경(예: NodeJS)에서도 사용하려면, 클라이언트에 ws 패키지가 필요합니다.

```sh
npm install ws
```

## 사용법

아래는 WebSocket과 @deepkit/rpc의 low-level API를 기반으로 한 완전한 예제입니다. Deepkit Framework를 사용할 경우, Controller는 app module을 통해 제공되며 RpcKernel을 수동으로 인스턴스화하지 않습니다.

_파일: server.ts_

```typescript
import { rpc, RpcKernel } from '@deepkit/rpc';
import { RpcWebSocketServer } from '@deepkit/rpc-tcp';

@rpc.controller('/main')
export class Controller {
    @rpc.action()
    hello(title: string): string {
        return 'Hello ' + title;
    }
}

const kernel = new RpcKernel();
kernel.registerController(Controller);
const server = new RpcWebSocketServer(kernel, 'localhost:8081');
server.start({
    host: '127.0.0.1',
    port: 8081,
});
console.log('Server started at ws://127.0.0.1:8081');

```

_파일: client.ts_

```typescript
import { RpcWebSocketClient } from '@deepkit/rpc';
import type { Controller } from './server';

async function main() {
    const client = new RpcWebSocketClient('ws://127.0.0.1:8081');
    const controller = client.controller<Controller>('/main');

    const result = await controller.hello('World');
    console.log('result', result);

    client.disconnect();
}

main().catch(console.error);

```

## Server Controller

Remote Procedure Call에서 "Procedure"라는 용어는 일반적으로 "Action"으로도 불립니다. Action은 클래스에 정의된 Method이며 `@rpc.action` decorator로 표시됩니다. 클래스 자체는 `@rpc.controller` decorator로 Controller로 표시되고 고유한 이름이 부여됩니다. 이 이름은 클라이언트에서 올바른 Controller를 지정할 때 참조됩니다. 필요한 만큼 여러 Controller를 정의하고 등록할 수 있습니다.


```typescript
import { rpc } from '@deepkit/rpc';

@rpc.controller('/main');
class Controller {
    @rpc.action()
    hello(title: string): string {
        return 'Hello ' + title;
    }

    @rpc.action()
    test(): boolean {
        return true;
    }
}
```

`@rpc.action()`으로 표시된 Method만 클라이언트에서 호출할 수 있습니다.

Type은 명시적으로 지정해야 하며 추론될 수 없습니다. 이는 serializer가 네트워크로 전송되기 전에 Type의 형태를 정확히 알아야 이들을 바이너리 데이터(BSON) 또는 JSON으로 변환할 수 있기 때문입니다.

## Client Controller

일반적인 RPC 흐름에서는 클라이언트가 서버의 Function을 실행합니다. 하지만 Deepkit RPC에서는 서버가 클라이언트의 Function을 실행하는 것도 가능합니다. 이를 허용하려면 클라이언트도 Controller를 등록할 수 있습니다.

TODO

## 의존성 주입 (Dependency Injection)

Deepkit Framework가 사용될 때, 클래스는 의존성 주입 컨테이너에 의해 인스턴스화되므로 애플리케이션의 다른 Provider에 자동으로 접근할 수 있습니다.

또한 [의존성 주입 (Dependency Injection)](dependency-injection.md#)을 참고하세요.

## RxJS 스트리밍

TODO

## Nominal Types

클라이언트가 Function 호출에서 데이터를 받을 때, 먼저 서버에서 직렬화되고 이후 클라이언트에서 역직렬화됩니다. Function의 Return Type에 Class가 포함되어 있으면, 해당 Class는 클라이언트 측에서 재구성되지만, nominal identity와 연결된 Method를 잃게 됩니다. 이 문제를 해결하려면 Class를 고유한 ID/이름으로 Nominal Type으로 등록하세요. 이 접근 방식은 RPC-API에서 사용되는 모든 Class에 적용해야 합니다.

Class를 등록하려면 `@entity.name('id')` decorator를 사용합니다.

```typescript
import { entity } from '@deepkit/type';

@entity.name('user')
class User {
    id!: number;
    firstName!: string;
    lastName!: string;
    get fullName() {
        return this.firstName + ' ' + this.lastName;
    }
}
```

이 Class가 Function의 결과로 사용되면, 그 identity가 보존됩니다.

```typescript
const controller = client.controller<Controller>('/main');

const user = await controller.getUser(2);
user instanceof User; //true when @entity.name is used, and false if not
```