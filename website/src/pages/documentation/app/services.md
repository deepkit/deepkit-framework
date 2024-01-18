# Services


Service is a broad category encompassing any value, function, or feature that an application needs. A service is typically a class with a narrow, well-defined purpose. It should do something specific and do it well.

A service in Deepkit (and in most other JavaScript/TypeScript frameworks) is a simple class registered in a module using a provider. The simplest provider is the class provider, which specifies only the class itself and nothing else. It then becomes a singleton in the dependency injection container of the module where it was defined.

Services are handled and instantiated by the dependency injection container and thus can be imported and used in other services, in controllers, and event listeners using constructor injection or property injection. See the chapter [Dependency injection](../dependency-injection) for more details.

To create a simple service, you write a class with a purpose:


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

And either register it in your application, or in a module:

```typescript
new App({
    providers: [UserManager]
}).run();
```

After doing so you can use this service in controllers, other services, or event listeners. For example, let's use this service in a CLI command or HTTP route:


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

A service is a fundamental building block in Deepkit and is not restricted to classes. In fact, a service can be any value, function, or feature needed by an application. To learn more about, see chapter [Dependency Injection](../dependency-injection).
