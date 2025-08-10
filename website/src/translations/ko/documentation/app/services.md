# 서비스


서비스는 애플리케이션에 필요한 모든 값, 함수, 또는 기능을 포괄하는 넓은 범주의 개념입니다. 서비스는 보통 범위가 좁고 명확히 정의된 목적을 가진 클래스입니다. 특정한 일을 잘 수행하도록 해야 합니다.

Deepkit(및 대부분의 다른 JavaScript/TypeScript 프레임워크)에서 서비스는 프로바이더를 사용해 모듈에 등록된 단순한 클래스입니다. 가장 단순한 프로바이더는 클래스 프로바이더로, 클래스 자체만 지정하며 그 외에는 아무것도 지정하지 않습니다. 이렇게 하면 서비스는 정의된 모듈의 의존성 주입 컨테이너에서 싱글톤이 됩니다.

서비스는 의존성 주입 컨테이너에 의해 처리되고 인스턴스화되므로, 생성자 주입 또는 프로퍼티 주입을 사용해 다른 서비스, 컨트롤러, 이벤트 리스너에서 가져와 사용할 수 있습니다. 자세한 내용은 [의존성 주입](../dependency-injection) 장을 참조하세요.

간단한 서비스를 만들기 위해 목적을 가진 클래스를 작성합니다:


```typescript
export interface User {
    username: string;
}

export class UserManager {
    users: User[] = [];

    addUser(user: User) {
        this.users.push(user);
    }
}
```

그리고 애플리케이션이나 모듈에 등록합니다:

```typescript
new App({
    providers: [UserManager]
}).run();
```

그 후 이 서비스를 컨트롤러, 다른 서비스, 또는 이벤트 리스너에서 사용할 수 있습니다. 예를 들어, 이 서비스를 CLI 커맨드나 HTTP 라우트에서 사용해 봅시다:


```typescript
import { App } from '@deepkit/app';
import { HttpRouterRegistry } from '@deepkit/http';

const app = new App({
    providers: [UserManager],
    imports: [new FrameworkModule({debug: true})]
});

app.command('test', (userManager: UserManager) => {
    for (const user of userManager.users) {
        console.log('User: ', user.username);
    }
});

const router = app.get(HttpRouterRegistry);

router.get('/', (userManager: UserManager) => {
    return userManager.users;
})

app.run();
```

서비스는 Deepkit의 근본적인 빌딩 블록이며 클래스에만 국한되지 않습니다. 실제로 서비스는 애플리케이션에 필요한 모든 값, 함수, 또는 기능이 될 수 있습니다. 더 자세히 알아보려면 [의존성 주입](../dependency-injection) 장을 참조하세요.