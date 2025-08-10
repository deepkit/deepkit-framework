# 服务


服务是一个广义的概念，涵盖应用所需的任何值、函数或特性。服务通常是一个具有狭窄且明确目的的类。它应当专注于做好一件具体的事情。

在 Deepkit（以及大多数其他 JavaScript/TypeScript 框架）中，服务是通过提供者在模块中注册的一个简单类。最简单的提供者是类提供者（class provider），它只指定类本身而不包含其他内容。随后，该类会在其定义所在模块的依赖注入容器中成为一个单例。

服务由依赖注入容器管理与实例化，因此可以通过构造函数注入或属性注入，在其他服务、控制器以及事件监听器中导入并使用。更多细节参见[依赖注入](../dependency-injection)一章。

要创建一个简单的服务，你只需编写一个有明确职责的类：


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

然后将其注册到你的应用或某个模块中：

```typescript
new App({
    providers: [UserManager]
}).run();
```

完成后，你就可以在控制器、其他服务或事件监听器中使用此服务。例如，我们在一个 CLI 命令或 HTTP 路由中使用它：


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

服务是 Deepkit 的基础构建块，并不局限于类。实际上，服务可以是应用所需的任何值、函数或特性。想了解更多，请参阅[依赖注入](../dependency-injection)一章。