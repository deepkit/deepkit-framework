# HTTP

HTTP 요청을 처리하는 일은 서버가 수행하는 가장 잘 알려진 작업 중 하나입니다. 이는 입력(HTTP request)을 출력(HTTP response)으로 변환하여 특정 작업을 수행합니다. 클라이언트는 다양한 방식으로 HTTP request를 통해 서버로 데이터를 보낼 수 있으며, 이는 올바르게 읽고 처리되어야 합니다. HTTP body뿐 아니라 HTTP query나 HTTP header 값으로도 전달될 수 있습니다. 데이터가 실제로 어떻게 처리되는지는 서버에 따라 달라집니다. 값이 어디로, 어떤 방식으로 클라이언트에 의해 전송되어야 하는지 정의하는 것은 서버입니다.

여기서 가장 중요한 우선순위는 사용자가 기대하는 동작을 정확히 수행하는 것뿐만 아니라, HTTP request로부터의 모든 입력을 올바르게 변환(deserialize)하고 검증(validate)하는 것입니다.

서버에서 HTTP request가 통과하는 pipeline은 다양하고 복잡할 수 있습니다. 많은 단순한 HTTP 라이브러리는 특정 route에 대해 HTTP request와 HTTP response만을 전달하고, 개발자가 HTTP response를 직접 처리할 것을 기대합니다. middleware API는 필요에 따라 이 pipeline을 확장할 수 있게 해줍니다.

_Express 예제_

```typescript
const http = express();
http.get('/user/:id', (request, response) => {
    response.send({id: request.params.id, username: 'Peter' );
});
```

이는 단순한 사용 사례에는 매우 잘 맞지만, 애플리케이션이 커질수록 모든 입력과 출력을 수동으로 serialize/deserialize하고 validate해야 하기 때문에 금방 혼란스러워집니다. 또한 database abstraction과 같은 객체와 서비스를 애플리케이션 자체에서 어떻게 획득할지에 대한 고려도 필요합니다. 이는 이러한 필수 기능들을 매핑하는 아키텍처를 그 위에 얹도록 개발자를 강제합니다.

반면 Deepkit의 HTTP Library는 TypeScript와 Dependency Injection의 강점을 활용합니다. 정의된 types를 기반으로 어떤 값에 대해서도 Serialization/Deserialization과 validation이 자동으로 수행됩니다. 또한 위의 예시처럼 functional API로 route를 정의하거나, 아키텍처의 다양한 요구를 충족하기 위해 controller classes를 통해 정의할 수도 있습니다.

이는 Node의 `http` module 같은 기존 HTTP 서버와 함께 또는 Deepkit framework와 함께 사용할 수 있습니다. 두 API 변형 모두 Dependency Injection container에 접근할 수 있으므로, 애플리케이션에서 database abstraction과 구성(configuration) 같은 객체를 편리하게 가져올 수 있습니다.

## Functional API 예시

```typescript
import { Positive } from '@deepkit/type';
import { http, HttpRouterRegistry } from '@deepkit/http';
import { FrameworkModule } from "@deepkit/framework";

//Functional API
const app = new App({
    imports: [new FrameworkModule()]
});
const router = app.get(HttpRouterRegistry);

router.get('/user/:id', (id: number & Positive, database: Database) => {
    // id는 number이며 양수임이 보장됩니다.
    // database는 DI Container에 의해 주입됩니다.
    return database.query(User).filter({ id }).findOne();
});

app.run();
```

## Class Controller API

```typescript
import { Positive } from '@deepkit/type';
import { http, HttpRouterRegistry } from '@deepkit/http';
import { FrameworkModule } from "@deepkit/framework";
import { User } from "discord.js";

//Controller API
class UserController {
    constructor(private database: Database) {
    }

    @http.GET('/user/:id')
    user(id: number & Positive) {
        return this.database.query(User).filter({ id }).findOne();
    }
}

const app = new App({
    controllers: [UserController],
    imports: [new FrameworkModule()]
});
```