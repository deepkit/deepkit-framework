# RPC

RPC(Remote Procedure Call)은 원격 서버의 함수를 로컬 함수처럼 호출할 수 있게 해준다. HTTP client-server 통신이 매핑을 위해 HTTP method와 URL을 사용하는 것과 달리, RPC는 매핑에 함수 이름을 사용한다. 전송할 데이터는 일반 함수 argument로 전달되며, 서버에서의 함수 호출 결과가 client로 되돌아온다.

RPC의 장점은 header, URL, query string 등과 함께 동작하지 않기 때문에 client-server 추상이 가볍다는 점이다. 단점은 RPC를 통해 서버의 함수를 브라우저에서 쉽게 호출하기 어렵고, 종종 특정 client가 필요하다는 점이다.

RPC의 핵심 기능 중 하나는 client와 server 사이의 데이터가 자동으로 serialize/deserialize된다는 것이다. 따라서 typesafe한 RPC client가 보통 가능하다. 일부 RPC 프레임워크는 사용자가 특정 형식으로 type(parameter type과 return type)을 제공하도록 강제한다. 이는 gRPC의 Protocol Buffers나 GraphQL 같은 DSL, 또는 JavaScript schema builder 형태일 수 있다. 추가적인 데이터 validation을 RPC 프레임워크에서 제공할 수 있지만, 모든 프레임워크가 지원하는 것은 아니다.

Deepkit RPC는 TypeScript 코드 자체에서 type을 추출하므로, code generator를 사용하거나 수동으로 정의할 필요가 없다. Deepkit은 parameter와 result의 자동 serialize/deserialize를 지원한다. Validation에서 추가 제약을 정의하면 자동으로 검증된다. 이는 RPC를 통한 통신을 매우 typesafe하고 효율적으로 만든다. Deepkit RPC의 `rxjs`를 통한 streaming 지원은 이 RPC 프레임워크를 실시간 통신에 적합한 도구로 만들어준다.

RPC의 개념을 설명하기 위해 다음 코드를 살펴보자:

```typescript
//server.ts
class Controller {
    hello(title: string): string {
        return 'Hello ' + title
    }
}
```

hello 같은 method는 서버의 class 내부에서 일반 함수처럼 구현되며, 원격 client가 호출할 수 있다.

```typescript
//client.ts
const client = new RpcClient('localhost');
const controller = client.controller<Controller>();

const result = await controller.hello('World'); // => 'Hello World';
```

RPC는 근본적으로 비동기 통신을 기반으로 하므로, 통신은 일반적으로 HTTP를 통해 이루어지지만 TCP나 WebSocket을 사용할 수도 있다. 이는 TypeScript의 모든 함수 호출이 자체적으로 `Promise`로 변환됨을 의미한다. 결과는 해당 `await`로 비동기적으로 받을 수 있다.

## Isomorphic TypeScript

프로젝트가 client(보통 frontend)와 server(backend) 모두에서 TypeScript를 사용할 때 이를 Isomorphic TypeScript라고 한다. TypeScript의 type에 기반한 typesafe RPC 프레임워크는 이러한 프로젝트에서 특히 유용한데, client와 server 사이에 type을 공유할 수 있기 때문이다.

이를 활용하기 위해 양쪽에서 사용하는 type은 별도의 파일이나 package로 분리하는 것이 좋다. 각 측에서 import하면 다시 함께 사용할 수 있다.

```typescript
//shared.ts
export class User {
    id: number;
    username: string;
}

//server.ts
import { User } from './shared';

@rpc.controller('/user')
class UserController  {
    async getUser(id: number): Promise<User> {
        return await datbase.query(User).filter({id}).findOne();
    }
}

//client.ts
import { UserControllerApi } from './shared';
import type { UserController } from './server.ts'
const controller = client.controller<UserController>('/user');
const user = await controller.getUser(2); // => User
```

하위 호환성은 일반적인 로컬 API와 동일한 방식으로 구현할 수 있다. 새로운 parameter를 optional로 표시하거나, 새로운 method를 추가하면 된다.