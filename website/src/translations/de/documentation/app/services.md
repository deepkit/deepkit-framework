# Services


Service ist eine breite Kategorie, die jeden Wert, jede Function oder jedes Feature umfasst, das eine Anwendung benötigt. Ein Service ist typischerweise eine Class mit einem engen, klar definierten Zweck. Er sollte etwas Spezifisches tun und das gut.

Ein Service in Deepkit (und in den meisten anderen JavaScript/TypeScript-Frameworks) ist eine einfache Class, die in einem Module mithilfe eines Providers registriert wird. Der einfachste Provider ist der Class Provider, der nur die Class selbst und sonst nichts angibt. Er wird dann zu einem Singleton im Dependency Injection Container des Modules, in dem er definiert wurde.

Services werden vom Dependency Injection Container verwaltet und instanziiert und können daher mittels Constructor Injection oder Property Injection in anderen Services, in Controllern und Event Listenern importiert und verwendet werden. Siehe das Kapitel [Dependency Injection](../dependency-injection) für weitere Details.

Um einen einfachen Service zu erstellen, schreiben Sie eine Class mit einem Zweck:


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

Und registrieren Sie ihn entweder in Ihrer Anwendung oder in einem Module:

```typescript
new App({
    providers: [UserManager]
}).run();
```

Danach können Sie diesen Service in Controllern, anderen Services oder Event Listenern verwenden. Verwenden wir diesen Service zum Beispiel in einem CLI-Command oder einer HTTP-Route:


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

Ein Service ist ein grundlegender Baustein in Deepkit und ist nicht auf Classes beschränkt. Tatsächlich kann ein Service jeder Wert, jede Function oder jedes Feature sein, das von einer Anwendung benötigt wird. Um mehr zu erfahren, siehe Kapitel [Dependency Injection](../dependency-injection).