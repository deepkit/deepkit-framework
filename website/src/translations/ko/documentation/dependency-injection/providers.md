# Providers

Dependency Injection 컨테이너에서 의존성을 제공하는 방법에는 여러 가지가 있습니다. 가장 단순한 방식은 클래스를 지정하는 것입니다. 이는 short ClassProvider라고도 합니다.

```typescript
new App({
    providers: [UserRepository]
});
```

이는 클래스만 지정되므로 특별한 Provider를 나타냅니다. 그 외의 모든 Provider는 객체 리터럴로 지정해야 합니다.

기본적으로 모든 Provider는 singleton으로 표시되어, 어떤 시점에도 인스턴스가 하나만 존재합니다. Provider가 배치될 때마다 새 인스턴스를 생성하려면 `transient` 옵션을 사용할 수 있습니다. 이렇게 하면 클래스는 매번 새로 생성되거나 factory가 매번 실행됩니다.

```typescript
new App({
    providers: [{ provide: UserRepository, transient: true }]
});
```

## ClassProvider

short ClassProvider 외에도 클래스 대신 객체 리터럴인 일반 ClassProvider가 있습니다.

```typescript
new App({
    providers: [{ provide: UserRepository, useClass: UserRepository }]
});
```

이는 다음 두 가지와 동일합니다.

```typescript
new App({
    providers: [{ provide: UserRepository }]
});

new App({
    providers: [UserRepository]
});
```

이를 사용하여 Provider를 다른 클래스로 교체할 수 있습니다.

```typescript
new App({
    providers: [{ provide: UserRepository, useClass: OtherUserRepository }]
});
```

이 예제에서 `OtherUserRepository` 클래스도 DI 컨테이너에서 관리되며, 해당 의존성은 모두 자동으로 해결됩니다.

## ValueProvider

정적 값을 이 Provider로 제공할 수 있습니다.

```typescript
new App({
    providers: [{ provide: OtherUserRepository, useValue: new OtherUserRepository() }]
});
```

의존성으로 제공될 수 있는 것이 클래스 인스턴스만은 아니므로, 어떤 값이든 `useValue`로 지정할 수 있습니다. symbol이나 primitive(string, number, boolean)도 Provider 토큰으로 사용할 수 있습니다.

```typescript
new App({
    providers: [{ provide: 'domain', useValue: 'localhost' }]
});
```

primitive Provider 토큰은 의존성으로서 Inject Type으로 선언해야 합니다.

```typescript
import { Inject } from '@deepkit/core';

class EmailService {
    constructor(public domain: Inject<string, 'domain'>) {}
}
```

inject 별칭과 primitive Provider 토큰의 조합은 런타임 타입 정보가 없는 패키지에서 의존성을 제공하는 데에도 사용할 수 있습니다.

```typescript
import { Inject } from '@deepkit/core';
import { Stripe } from 'stripe';

export type StripeService = Inject<Stripe, '_stripe'>;

new App({
    providers: [{ provide: '_stripe', useValue: new Stripe }]
});
```

그리고 사용자 측에서는 다음과 같이 선언합니다.

```typescript
class PaymentService {
    constructor(public stripe: StripeService) {}
}
```

## ExistingProvider

이미 정의된 Provider로의 포워딩을 정의할 수 있습니다.

```typescript
new App({
    providers: [
        {provide: OtherUserRepository, useValue: new OtherUserRepository()},
        {provide: UserRepository, useExisting: OtherUserRepository}
    ]
});
```

## FactoryProvider

함수를 사용하여 Provider에 대한 값을 제공할 수 있습니다. 이 함수는 매개변수를 포함할 수 있으며, 해당 매개변수는 DI 컨테이너에 의해 다시 제공됩니다. 따라서 다른 의존성이나 구성 옵션에 접근할 수 있습니다.

```typescript
new App({
    providers: [
        {provide: OtherUserRepository, useFactory: () => {
            return new OtherUserRepository()
        }},
    ]
});

new App({
    providers: [
        {provide: OtherUserRepository, useFactory: (domain: RootConfiguration['domain']) => {
            return new OtherUserRepository(domain);
        }},
    ]
});

new App({
    providers: [
        Database,
        {provide: OtherUserRepository, useFactory: (database: Database) => {
            return new OtherUserRepository(database);
        }},
    ]
});
```

## InterfaceProvider

클래스와 primitive 외에도, 추상화(Interface)도 제공할 수 있습니다. 이는 `provide` 함수를 통해 이루어지며, 제공할 값에 타입 정보가 없는 경우 특히 유용합니다.

```typescript
import { provide } from '@deepkit/injector';

interface Connection {
    write(data: Uint16Array): void;
}

class Server {
   constructor (public connection: Connection) {}
}

class MyConnection {
    write(data: Uint16Array): void {}
}

new App({
    providers: [
        Server,
        provide<Connection>(MyConnection)
    ]
});
```

여러 Provider가 Connection Interface를 구현한 경우, 마지막 Provider가 사용됩니다.

provide()의 인자로는 다른 모든 Provider 유형이 가능합니다.

```typescript
const myConnection = {write: (data: any) => undefined};

new App({
    providers: [
        provide<Connection>({ useValue: myConnection })
    ]
});

new App({
    providers: [
        provide<Connection>({ useFactory: () => myConnection })
    ]
});
```

## Asynchronous Providers

`@deepkit/injector`의 설계는 비동기 Dependency Injection 컨테이너와 함께 비동기 Provider를 사용하는 것을 배제합니다. 이는 Provider 요청 또한 비동기여야 하며, 그 결과 애플리케이션 전체가 최상위에서 비동기로 동작해야 하기 때문입니다.

무언가를 비동기로 초기화해야 한다면, 애플리케이션 서버 bootstrap으로 이 초기화를 이동해야 합니다. 거기서는 이벤트가 비동기일 수 있습니다. 또는 초기화를 수동으로 트리거할 수도 있습니다.

## Configure Providers

구성 콜백을 사용하면 Provider의 결과를 조작할 수 있습니다. 이는 예를 들어 다른 의존성 주입 방식인 method injection을 사용할 때 유용합니다.

이들은 module API 또는 app API에서만 사용할 수 있으며 모듈 상단에서 등록됩니다.

```typescript
class UserRepository  {
    private db?: Database;
    setDatabase(db: Database) {
       this.db = db;
    }
}

const rootModule = new InjectorModule([UserRepository])
     .addImport(lowLevelModule);

rootModule.configureProvider<UserRepository>(v => {
  v.setDatabase(db);
});
```

`configureProvider`는 콜백에서 첫 번째 Parameter인 `v`로 UserRepository 인스턴스를 전달받으며, 그 인스턴스의 Method를 호출할 수 있습니다.

Method 호출 외에도 Property를 설정할 수 있습니다.

```typescript
class UserRepository  {
    db?: Database;
}

const rootModule = new InjectorModule([UserRepository])
     .addImport(lowLevelModule);

rootModule.configureProvider<UserRepository>(v => {
  v.db = new Database();
});
```

모든 콜백은 큐에 배치되며, 정의된 순서대로 실행됩니다.

큐의 호출은 Provider가 생성되자마자 Provider의 실제 결과에 대해 실행됩니다. 즉, ClassProvider의 경우 인스턴스가 생성되는 즉시 그 클래스 인스턴스에 적용되고, FactoryProvider의 경우 Factory의 결과에 적용되며, ValueProvider의 경우 해당 Provider에 적용됩니다.

정적 값뿐 아니라 다른 Provider를 참조하기 위해, 콜백의 인자로 단지 정의하는 것만으로 임의의 의존성을 주입할 수 있습니다. 이러한 의존성이 Provider 스코프 내에서 알려져 있는지 확인하십시오.

```typescript
class Database {}

class UserRepository  {
    db?: Database;
}

const rootModule = new InjectorModule([UserRepository, Database])
rootModule.configureProvider<UserRepository>((v, db: Database) => {
  v.db = db;
});
```

## Nominal types

`configureProvider`에 전달된 타입은, 마지막 예제의 `UserRepository`와 같이, 구조적 타입 검사로 해석되는 것이 아니라 nominal types로 해석된다는 점에 유의하세요. 이는 예를 들어 동일한 구조지만 다른 정체성을 가진 두 클래스/Interface는 호환되지 않음을 의미합니다. `get<T>` 호출이나 의존성이 해결될 때도 마찬가지입니다.

이는 구조적 타입 검사에 기반한 TypeScript의 타입 검사 방식과 다릅니다. 이 설계 결정은 우발적인 오구성(예: 모든 클래스와 구조적으로 호환되는 빈 클래스를 요청하는 경우)을 방지하고 코드를 더 견고하게 만들기 위해 이루어졌습니다.

다음 예제에서 `User1`과 `User2` 클래스는 구조적으로는 호환되지만 nominal하게는 호환되지 않습니다. 즉, `User1`을 요청해도 `User2`가 해결되지 않으며 그 반대도 마찬가지입니다.

```typescript

class User1 {
    name: string = '';
}

class User2 {
    name: string = '';
}

new App({
    providers: [User1, User2]
});
```

클래스를 상속하거나 Interface를 구현하면 nominal 관계가 성립합니다.

```typescript
class UserBase {
    name: string = '';
}

class User extends UserBase {
}

const app = new App({
    providers: [User2]
});

app.get(UserBase); // User를 반환
```

```typescript
interface UserInterface {
    name: string;
}

class User implements UserInterface {
    name: string = '';
}

const app = new App({
    providers: [User]
});

app.get<UserInterface>(); // User를 반환
```